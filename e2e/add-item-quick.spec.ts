import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

/** Same helper as the other list specs: a dated name so two runs never collide on the same card. */
async function newList(page: Page, name: string) {
	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(name);
	await page.getByTestId('list-create').click();

	const card = page.locator('[data-test-class="list-card"]').filter({ hasText: name });
	await expect(card).toBeVisible();
	await card.getByRole('link').first().click();
	await expect(page).toHaveURL(/\/l\//);
}

test('ajouter plusieurs articles à la suite sans rouvrir le formulaire', async ({
	signedInPage: page
}) => {
	const name = `Courses e2e ${Date.now()}`;
	await newList(page, name);

	await page.getByTestId('empty-add-item').click();

	await page.getByTestId('add-name').fill('Lait e2e');
	await page.getByTestId('add-submit').click();

	// The sheet stays open, the field clears and keeps focus: the next item goes straight in.
	await expect(page.getByTestId('add-item')).toBeVisible();
	await expect(page.getByTestId('add-name')).toHaveValue('');
	await expect(page.getByTestId('add-name')).toBeFocused();
	await expect(page.getByTestId('add-counter')).toContainText('1');

	await page.getByTestId('add-name').fill('Oeufs e2e');
	await page.getByTestId('add-submit').click();
	await expect(page.getByTestId('add-counter')).toContainText('2');

	await page.getByTestId('add-close').click();

	await expect(
		page.locator('[data-test-class="item-row"]').filter({ hasText: 'Lait e2e' })
	).toBeVisible();
	await expect(
		page.locator('[data-test-class="item-row"]').filter({ hasText: 'Oeufs e2e' })
	).toBeVisible();
});

test('la barquette est proposée dans les unités de conditionnement', async ({
	signedInPage: page
}) => {
	const name = `Courses e2e ${Date.now()}`;
	await newList(page, name);

	await page.getByTestId('empty-add-item').click();
	await page.getByTestId('add-name').fill('Fraises e2e');
	await page.getByTestId('add-unit-group-pack').click({ force: true });

	await expect(page.getByTestId('add-unit-tray')).toBeVisible();
});

test('reprend le rayon et l unité utilisés la dernière fois pour ce produit', async ({
	signedInPage: page
}) => {
	const name = `Courses e2e ${Date.now()}`;
	const product = `Yaourt e2e ${Date.now()}`;
	await newList(page, name);

	await page.getByTestId('empty-add-item').click();
	await page.getByTestId('add-name').fill(product);
	await page.getByTestId('add-unit-group-pack').click({ force: true });
	await page.getByTestId('add-unit-tray').click({ force: true });
	await page.getByTestId('add-aisle').selectOption({ index: 1 });
	const chosenAisle = await page.getByTestId('add-aisle').inputValue();
	await page.getByTestId('add-submit').click();
	await page.getByTestId('add-close').click();

	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-item').click();
	await page.getByTestId('add-name').fill(product);

	await expect(page.getByTestId('add-unit-tray')).toBeChecked();
	await expect(page.getByTestId('add-aisle')).toHaveValue(chosenAisle);
});
