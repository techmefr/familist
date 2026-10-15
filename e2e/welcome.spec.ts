import { test, expect } from './fixtures';

/**
 * `hasSeenWelcome` vit dans `localStorage` (clé `familist:appearance`, voir `$stores/settings.svelte.ts`) :
 * un navigateur tout neuf n'a rien écrit là-dedans, donc `signedOutHome` dans `+layout.svelte` renvoie vers
 * `/welcome` plutôt que `/auth`. On utilise ici la fixture `page` nue, jamais `signedInPage`, qui pré-remplit
 * justement cette clé pour neutraliser ce même écran dans les autres suites.
 */
test.describe('accueil et premier lancement', () => {
	test('un premier lancement atterrit sur l ecran de bienvenue', async ({ page }) => {
		await page.goto('/');

		await expect(page).toHaveURL(/\/welcome/);
		await expect(page.getByTestId('welcome-step')).toBeVisible();
	});

	test('choisir une taille de texte', async ({ page }) => {
		await page.goto('/welcome');
		await page.getByTestId('welcome-next').click();

		const label = page.getByTestId('welcome-size-label');
		const initial = (await label.innerText()).trim();

		const slider = page.getByTestId('welcome-size');
		await slider.focus();
		await slider.press('ArrowRight');
		await slider.press('ArrowRight');

		await expect(label).not.toHaveText(initial);
		await expect(page.getByTestId('welcome-preview')).toBeVisible();
	});

	test('sauter l etape mene sur l ecran de connexion', async ({ page }) => {
		await page.goto('/welcome');

		await page.getByTestId('welcome-skip').click();

		await expect(page).toHaveURL(/\/auth/);
	});
});

for (const width of [320, 390, 768]) {
 test(`drapeaux et noms natifs visibles a ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/welcome');
  const labels = page.locator('.fl-language-label');
  await expect(labels).toHaveCount(10);
  for (const label of await labels.all()) {
   const flag = label.locator('img');
   await expect(flag).toBeVisible();
   await expect.poll(() => flag.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
   const name = label.locator('span[lang]');
   await expect(name).toBeVisible();
   expect(await name.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
 });
}
