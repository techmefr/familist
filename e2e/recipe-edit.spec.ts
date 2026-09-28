import { test, expect } from './fixtures';

test.describe('modifier une recette', () => {
	test('le bouton modifier amene au formulaire rempli, et l enregistrement revient sur la carte', async ({
		signedInPage: page
	}) => {
		const name = `Recette a modifier e2e ${Date.now()}`;

		await page.goto('/recipes/new');
		await page.getByTestId('recipe-source-manual').click();
		await page.getByTestId('recipe-name').fill(name);
		await page.getByTestId('recipe-servings').fill('6');
		await page.getByTestId('recipe-notes').fill('Meilleure le lendemain');
		await page.getByTestId('recipe-next').click();
		await page.locator('[data-test-class="ingredient-name"]').first().fill('Farine');
		await page.locator('[data-test-class="ingredient-qty"]').first().fill('250');
		await page.getByTestId('recipe-next').click();
		await page.locator('[data-test-class="recipe-step"]').first().fill('Tout melanger');
		await page.getByTestId('recipe-next').click();

		const card = page.locator('[data-test-class="recipe-card"]').filter({ hasText: name });
		// A recipe now opens its own page (#373) instead of unfolding inline.
		await card.locator('[data-test-class="recipe-card-header"]').click();
		await expect(page.locator('[data-test-class="recipe-notes-body"]')).toHaveText('Meilleure le lendemain');

		await page.locator('[data-test-class="recipe-edit"]').click();

		const title = page.getByTestId('recipe-form-title');
		await expect(title).toBeInViewport();
		await expect(title).toBeFocused();
		await expect(page.getByTestId('recipe-name')).toHaveValue(name);
		await expect(page.getByTestId('recipe-servings')).toHaveValue('6');
		await expect(page.getByTestId('recipe-notes')).toHaveValue('Meilleure le lendemain');
		await expect(page.getByTestId('recipe-form').locator('[data-test-class="recipe-photo-button"]')).toBeVisible();

		const renamed = `${name} bis`;
		await page.getByTestId('recipe-name').fill(renamed);
		await page.getByTestId('recipe-notes').fill('Encore meilleure le surlendemain');
		await page.getByTestId('recipe-next').click();

		await expect(page.locator('[data-test-class="ingredient-name"]').first()).toHaveValue('Farine');
		await expect(page.locator('[data-test-class="ingredient-qty"]').first()).toHaveValue('250');
		await page.locator('[data-test-class="ingredient-name"]').first().fill('Farine de ble');
		await page.getByTestId('recipe-next').click();

		await expect(page.locator('[data-test-class="recipe-step"]').first()).toHaveValue('Tout melanger');
		await page.getByTestId('recipe-next').click();

		const edited = page.locator('[data-test-class="recipe-card"]').filter({ hasText: renamed });
		await expect(edited).toBeInViewport();

		await edited.locator('[data-test-class="recipe-card-header"]').click();
		await expect(page.getByTestId('recipe-detail')).toContainText('Farine de ble');
		await expect(page.locator('[data-test-class="recipe-notes-body"]')).toHaveText(
			'Encore meilleure le surlendemain'
		);
	});

	test('la carte du mur n a plus de boutons: modifier, ajouter une photo, generer et supprimer passent par le menu (#373)', async ({
		signedInPage: page
	}) => {
		const name = `Recette a supprimer e2e ${Date.now()}`;

		await page.goto('/recipes/new');
		await page.getByTestId('recipe-source-manual').click();
		await page.getByTestId('recipe-name').fill(name);
		await page.getByTestId('recipe-next').click();
		await page.locator('[data-test-class="ingredient-name"]').first().fill('Sel');
		await page.getByTestId('recipe-next').click();
		await page.locator('[data-test-class="recipe-step"]').first().fill('Saler.');
		await page.getByTestId('recipe-next').click();

		const card = page.locator('[data-test-class="recipe-card"]').filter({ hasText: name });
		await expect(card).toBeVisible();

		// None of the four actions sit on the card itself.
		for (const testClass of ['recipe-edit', 'recipe-delete', 'recipe-generate', 'recipe-photo-button']) {
			await expect(card.locator(`[data-test-class="${testClass}"]`)).toHaveCount(0);
		}

		await card.locator('[data-test-class="recipe-card-actions"]').click();
		const sheet = page.getByTestId('recipe-actions-sheet');
		await expect(sheet).toBeVisible();
		await expect(sheet.getByTestId('recipe-actions-edit')).toBeVisible();
		await expect(sheet.getByTestId('recipe-actions-photo')).toBeVisible();
		await expect(sheet.getByTestId('recipe-actions-generate')).toBeVisible();

		await sheet.getByTestId('recipe-actions-delete').click();
		const confirmButton = page.locator('[data-test-class="recipe-delete-confirm"]');
		await expect(confirmButton).toBeVisible();
		await confirmButton.click();

		await expect(card).toHaveCount(0);
	});
});
