import { test, expect } from './fixtures';

/**
 * A guest with a tree-nut allergy, then a pesto on a list: the warning appears, names the guest and is
 * made of words and an icon (#477, #480).
 */
test('un invité allergique aux fruits à coque : le pesto déclenche une alerte', async ({
	signedInPage: page
}) => {
	const guest = `Invité ${Date.now()}`;

	await page.goto('/household');
	await page.getByTestId('household-person-name').fill(guest);
	await page.getByTestId('household-person-add').click();

	const row = page.locator('[data-test-class="household-person"]').filter({ hasText: guest });
	await expect(row).toBeVisible();

	await row.getByRole('button', { name: /./ }).first().click();
	await expect(page.getByTestId('person-sheet')).toBeVisible();
	await expect(page.getByTestId('person-private')).toBeVisible();

	await page.locator('label:has([data-test-id="person-allergen-nuts"])').click();
	await page.getByTestId('person-save').click();
	await expect(row.locator('[data-test-class="person-chips"]')).toBeVisible();

	const listName = `Alerte ${Date.now()}`;
	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(listName);
	await page.getByTestId('list-create').click();
	await page.locator('[data-test-class="list-card"]').filter({ hasText: listName }).getByRole('link').first().click();

	await page.getByTestId('empty-add-item').click();
	await page.getByTestId('add-name').fill('Pesto');
	const warning = page.getByTestId('allergy-warning');
	await expect(warning).toContainText(guest);

	// Never blocking: the item still goes in.
	await page.getByTestId('add-submit').click();
	await page.getByTestId('add-close').click();
	await expect(page.locator('[data-test-class="item-row"]').filter({ hasText: 'Pesto' })).toBeVisible();
});
