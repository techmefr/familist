import { test, expect } from './fixtures';

for (const width of [320, 768, 1280]) {
 test(`la cloche affiche les demandes de cartes a ${width}px`, { tag: '@critical' }, async ({ signedInPage: page }) => {
  await page.setViewportSize({ width, height: 900 });
  let pending = true;
  await page.route('**/rest/v1/rpc/pending_loyalty_card_shares', route => route.fulfill({
   json: pending ? [{ card_id: '33333333-3333-3333-3333-333333333333', household_id: '44444444-4444-4444-4444-444444444444', card_name: 'Carte de test', shared_by_name: 'Camille' }] : []
  }));
  await page.route('**/rest/v1/rpc/decide_loyalty_card_share', route => {
   pending = false;
   return route.fulfill({ json: null });
  });
  await page.getByTestId('header-notifications').click();
  const center = page.getByTestId('notification-center');
  await expect(center).toBeVisible();
  const request = center.locator('[data-test-class="notification-card-request"]');
  await expect(request).toHaveCount(1);
  await expect(request).toContainText('Carte de test');
  await expect(request).toContainText('Camille');
  const bounds = await center.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
  await request.getByRole('button').first().click();
  await expect(request).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(center).not.toBeVisible();
  await expect(page.getByTestId('header-notifications')).toBeFocused();
 });
}

test('une erreur de chargement propose de reessayer sans notification vide trompeuse', { tag: '@critical' }, async ({ signedInPage: page }) => {
 await page.route('**/rest/v1/rpc/pending_loyalty_card_shares', route => route.fulfill({ status: 503, json: { message: 'Unavailable' } }));
 await page.getByTestId('header-notifications').click();
 const center = page.getByTestId('notification-center');
 await expect(center.getByRole('alert')).toBeVisible();
 await expect(center.getByRole('button').last()).toBeEnabled();
});
