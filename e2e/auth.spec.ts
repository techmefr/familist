import { test, expect, FIXTURE_EMAIL, FIXTURE_PASSWORD } from './fixtures';

test.describe('connexion', () => {
	test('un mot de passe erroné affiche une erreur et ne connecte pas', { tag: '@critical' }, async ({ page }) => {
		await page.goto('/auth');
		await page.getByTestId('mode-signin').check();
		await page.getByTestId('auth-use-password').click();
		await page.getByTestId('auth-email').fill(FIXTURE_EMAIL);
		await page.getByTestId('auth-password').fill('un-mot-de-passe-qui-ne-marche-pas');
		await page.getByTestId('auth-submit').click();

		await expect(page.getByTestId('auth-error')).toBeVisible();
		await expect(page).toHaveURL(/\/auth/);
	});

	test('un compte valide arrive sur ses listes', { tag: '@critical' }, async ({ page }) => {
		await page.goto('/auth');
		await page.getByTestId('mode-signin').check();
		await page.getByTestId('auth-use-password').click();
		await page.getByTestId('auth-email').fill(FIXTURE_EMAIL);
		await page.getByTestId('auth-password').fill(FIXTURE_PASSWORD);
		await page.getByTestId('auth-submit').click();

		await expect(page.getByTestId('nav-create')).toBeVisible({ timeout: 15_000 });
		await expect(page).toHaveURL('/');
	});

	test('le lien par e-mail est proposé en premier, le mot de passe ensuite', { tag: '@critical' }, async ({ page }) => {
		await page.goto('/auth');
		await page.getByTestId('mode-signin').check();

		await expect(page.getByTestId('auth-code-form')).toBeVisible();
		await expect(page.getByTestId('auth-password')).toHaveCount(0);

		await page.getByTestId('auth-use-password').click();
		await expect(page.getByTestId('auth-password')).toBeVisible();
	});
});

test.describe('session', () => {
	test('se déconnecter renvoie vers un écran public', { tag: '@critical' }, async ({ signedInPage: page }) => {
		await page.goto('/profile/account');
		await page.getByTestId('sign-out').click();

		// /welcome on a browser that has seen nothing yet, /auth otherwise: both are public, and it is precisely
		// this detour through the welcome screen that we want to see happen here.
		await expect(page).toHaveURL(/\/auth|\/welcome/);
	});

	test('une session déconnectée est renvoyée depuis une page protégée', { tag: '@critical' }, async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL(/\/auth|\/welcome/);
	});
});
