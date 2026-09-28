import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * The queue/retry layer (#382): a 429 from the provider must not surface as a hard failure — it is retried
 * on its own, with a visible "waiting to retry" status, and the screen updates when the retried call
 * finally succeeds. Same mocking approach as `ai-recipe-request.spec.ts` (fake key, `api.anthropic.com`
 * intercepted), one extra route step returning 429 once before the real answer.
 */
const FAKE_RECIPE = {
	name: `Recette apres retry e2e ${Date.now()}`,
	emoji: '🥘',
	servings: 4,
	ingredients: [{ name: 'Riz', qty: '300', unit: 'g' }],
	steps: ['Cuire le riz.']
};

async function mockAnthropicRateLimitedThenOk(page: Page, recipe: unknown) {
	let calls = 0;
	await page.route('https://api.anthropic.com/v1/messages', async (route) => {
		calls += 1;
		if (calls === 1) {
			await route.fulfill({
				status: 429,
				contentType: 'application/json',
				body: JSON.stringify({ error: { message: 'rate limited' } })
			});
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ content: [{ text: JSON.stringify(recipe) }] })
		});
	});
}

async function setFakeKey(page: Page) {
	await page.goto('/profile/ai');
	await expect(page.getByTestId('ai-state')).toBeVisible();

	const remove = page.getByTestId('ai-clear');
	if ((await remove.count()) > 0) await remove.click();
	await expect(page.getByTestId('ai-state')).toHaveAttribute('data-test-state', 'off');

	await page.getByTestId('ai-key').fill('cle-de-test-sans-valeur');
	await page.getByTestId('ai-save').click();
	await expect(page.getByTestId('ai-state')).toHaveAttribute('data-test-state', 'on');
}

async function clearKey(page: Page) {
	await page.goto('/profile/ai');
	await expect(page.getByTestId('ai-state')).toBeVisible();
	const remove = page.getByTestId('ai-clear');
	if ((await remove.count()) > 0) await remove.click();
	await expect(page.getByTestId('ai-state')).toHaveAttribute('data-test-state', 'off');
}

test.describe('file d attente et nouvel essai apres une limite de debit', () => {
	test.beforeEach(async ({ signedInPage: page }) => {
		await setFakeKey(page);
	});

	test.afterEach(async ({ signedInPage: page }) => {
		await clearKey(page);
	});

	test('un 429 est mis en attente puis la demande aboutit toute seule', async ({
		signedInPage: page
	}) => {
		await mockAnthropicRateLimitedThenOk(page, FAKE_RECIPE);

		await page.goto('/recipes/new');
		await page.getByTestId('recipe-source-ai').click();
		await page.getByTestId('ai-request-input').fill('un plat de riz');
		await page.getByTestId('ai-request-submit').click();

		// Waiting to retry is shown, not a hard failure: a "progress" toast, visibly different from an error one.
		const toast = page.locator('[data-test-class="toast"][data-tone="progress"]');
		await expect(toast).toBeVisible({ timeout: 10_000 });

		// The screen updates on its own once the retried call succeeds, with no manual retry from the person.
		const proposal = page.getByTestId('ai-proposal');
		await expect(proposal).toBeVisible({ timeout: 15_000 });
		await expect(proposal).toContainText(FAKE_RECIPE.name);
		await expect(toast).toHaveCount(0);
	});
});
