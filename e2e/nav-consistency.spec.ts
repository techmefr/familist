import { test, expect } from './fixtures';

/**
 * The navigation chrome unified across screens (#351, #352, #353):
 * - the "My lists" card no longer carries permanent pencil/duplicate/delete icons; they live in the
 *   shared long-press action menu, reachable without a pointer through the "⋯" button.
 * - the loyalty-cards page shows a bottom search + filter bar instead of a header search toggle.
 */
test('la carte de liste ouvre son menu d actions au bouton "⋯", sans icônes permanentes', async ({
	signedInPage: page
}) => {
	const name = `Nav e2e ${Date.now()}`;

	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(name);
	await page.getByTestId('list-create').click();

	const card = page.locator('[data-test-class="list-card"]').filter({ hasText: name });
	await expect(card).toBeVisible();

	// No permanent pencil/duplicate/delete icons left on the card.
	await expect(card.locator('[data-test-class="list-rename"]')).toHaveCount(0);
	await expect(card.locator('[data-test-class="list-duplicate"]')).toHaveCount(0);
	await expect(card.locator('[data-test-class="list-delete"]')).toHaveCount(0);

	// The single "⋯" button opens the shared action menu.
	await card.locator('[data-test-class="list-actions"]').click();
	await expect(page.getByTestId('action-sheet-edit')).toBeVisible();
	await expect(page.getByTestId('action-sheet-duplicate')).toBeVisible();
	await expect(page.getByTestId('action-sheet-delete')).toBeVisible();

	await page.getByTestId('action-sheet-delete').click();
	await expect(card).toHaveCount(0);
});

test('la page des cartes montre une barre de recherche et filtres en bas, sans bascule de recherche', async ({
	signedInPage: page
}) => {
	await page.goto('/cards');

	// The old toggle-based search is gone; the bar and its field are always there once cards exist.
	await expect(page.getByTestId('cards-search-toggle')).toHaveCount(0);
	await expect(page.getByTestId('cards-search-bar')).toBeVisible();
	await expect(page.getByTestId('cards-search-search')).toBeVisible();
	await expect(page.getByTestId('cards-search-filters-open')).toBeVisible();
});
