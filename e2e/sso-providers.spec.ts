import { test, expect } from '@playwright/test';

/**
 * The providers an instance offers come from its `config.js` (#498). Here the file is rewritten on the way
 * to the page, the same as an operator setting PUBLIC_OAUTH_PROVIDERS: the platform's own account is the
 * first button and every other service sits behind "More".
 */
test('le premier fournisseur est affiché, les autres derrière « Plus »', async ({ page }) => {
	await page.route('**/config.js', async route => {
		const response = await route.fetch();
		const body = await response.text();
		await route.fulfill({
			response,
			body: `${body}\nwindow.__FAMILIST_CONFIG__.oauthProviders = 'github, apple, google';\n`
		});
	});

	await page.goto('/auth');

	await expect(page.getByTestId('auth-provider-google')).toBeVisible();
	await expect(page.getByTestId('auth-provider-apple')).toHaveCount(0);
	await expect(page.getByTestId('auth-provider-github')).toHaveCount(0);

	const more = page.getByTestId('auth-providers-more');
	await expect(more).toHaveAttribute('aria-expanded', 'false');
	await more.click();
	await expect(more).toHaveAttribute('aria-expanded', 'true');
	await expect(page.getByTestId('auth-provider-apple')).toBeVisible();
	await expect(page.getByTestId('auth-provider-github')).toBeVisible();
});

test('sans fournisseur configuré, aucun bouton ni séparateur', async ({ page }) => {
	await page.goto('/auth');

	await expect(page.getByTestId('auth-providers')).toHaveCount(0);
	await expect(page.getByTestId('auth-providers-more')).toHaveCount(0);
});
