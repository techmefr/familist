import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

const STEPS = ['Couper les légumes', 'Faire revenir dix minutes', 'Servir chaud'];

async function openRecipeWithSteps(page: import('@playwright/test').Page, name: string) {
	await page.goto('/recipes/new');
	await page.getByTestId('recipe-source-manual').click();
	await page.getByTestId('recipe-name').fill(name);
	await page.getByTestId('recipe-next').click();

	await page.locator('[data-test-class="ingredient-name"]').first().fill('Courgettes');
	await page.getByTestId('recipe-next').click();

	for (const [index, body] of STEPS.entries()) {
		if (index > 0) await page.getByTestId('recipe-add-step').click();
		await page.locator('[data-test-class="recipe-step"]').nth(index).fill(body);
	}
	await page.getByTestId('recipe-next').click();

	const card = page.locator('[data-test-class="recipe-card"]').filter({ hasText: name });
	await expect(card).toBeVisible();
	// A recipe now opens its own page (#373) instead of unfolding inline.
	await card.locator('[data-test-class="recipe-card-header"]').click();
	await expect(page.getByTestId('recipe-detail')).toBeVisible();
}

/** Cook-along's stepper (#307, streamlined for #375): position in words, and a thin progress bar. */
test.describe('suivre la recette', () => {
	test('la position avance a chaque etape, et le titre suit', async ({ signedInPage: page }) => {
		await openRecipeWithSteps(page, `Poêlée e2e ${Date.now()}`);
		await page.locator('[data-test-class="recipe-cook-along"]').click();

		const cookAlong = page.getByTestId('cook-along');
		const position = cookAlong.getByTestId('cook-along-position');
		const bar = cookAlong.getByTestId('cook-along-progress-bar');

		await expect(position).toHaveAttribute('aria-live', 'polite');
		await expect(position).toContainText('1');
		await expect(bar).toBeVisible();
		await expect(cookAlong.getByTestId('cook-along-step')).toHaveText(STEPS[0]);

		await cookAlong.getByTestId('cook-along-next').click();
		await cookAlong.getByTestId('cook-along-next').click();
		await expect(cookAlong.getByTestId('cook-along-step')).toHaveText(STEPS[2]);
		await expect(position).toContainText('3');
		await expect(cookAlong.getByTestId('cook-along-next')).toBeDisabled();

		const results = await new AxeBuilder({ page })
			.include('[data-test-id="cook-along"]')
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
			.analyze();
		expect(results.violations).toEqual([]);
	});

	test('les zones de tap avancent et reculent', async ({ signedInPage: page }) => {
		await openRecipeWithSteps(page, `Poêlée tap e2e ${Date.now()}`);
		await page.locator('[data-test-class="recipe-cook-along"]').click();

		const cookAlong = page.getByTestId('cook-along');
		await cookAlong.getByTestId('cook-along-tap-next').click({ force: true });
		await expect(cookAlong.getByTestId('cook-along-step')).toHaveText(STEPS[1]);

		await cookAlong.getByTestId('cook-along-tap-previous').click({ force: true });
		await expect(cookAlong.getByTestId('cook-along-step')).toHaveText(STEPS[0]);
	});

	test('le bouton fermer quitte le mode et revient sur la page de la recette', async ({ signedInPage: page }) => {
		await openRecipeWithSteps(page, `Poêlée fermer e2e ${Date.now()}`);
		await page.locator('[data-test-class="recipe-cook-along"]').click();

		const cookAlong = page.getByTestId('cook-along');
		await cookAlong.getByTestId('cook-along-close').click();
		await expect(cookAlong).not.toBeVisible();
		await expect(page.getByTestId('recipe-detail')).toBeVisible();
	});

	test('de droite a gauche, la fleche de gauche avance', async ({ signedInPage: page }) => {
		await openRecipeWithSteps(page, `Poêlée rtl e2e ${Date.now()}`);
		await page.evaluate(() => (document.documentElement.dir = 'rtl'));
		await page.locator('[data-test-class="recipe-cook-along"]').click();

		const cookAlong = page.getByTestId('cook-along');
		await page.keyboard.press('ArrowLeft');
		await expect(cookAlong.getByTestId('cook-along-step')).toHaveText(STEPS[1]);

		await page.keyboard.press('ArrowRight');
		await expect(cookAlong.getByTestId('cook-along-step')).toHaveText(STEPS[0]);
	});
});
