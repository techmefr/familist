import { test, expect } from './fixtures';
import type { Locator, Page } from '@playwright/test';
test.use({ hasTouch: true });
async function position(locator: Locator) {
 return locator.evaluate(element => { const r = element.getBoundingClientRect(); return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height }; });
}
async function createChat(page: Page, name: string) {
 await page.goto('/'); await page.getByTestId('nav-create').click(); await page.getByTestId('create-list').click();
 await page.getByTestId('list-name').fill(name); await page.getByTestId('list-create').click();
 await page.getByTestId('nav-/chat').click(); await page.locator('[data-test-class="chat-entry"]').filter({ hasText: name }).click();
 await expect(page.getByTestId('chat-input')).toBeVisible(); await page.evaluate(() => document.fonts.ready);
}
for (const width of [320, 390, 768]) test(`la saisie reste stable au focus et après les messages à ${width}px`, { tag: '@critical' }, async ({ signedInPage: page }) => {
 await page.setViewportSize({ width, height: 900 }); await createChat(page, `Composer ${width} ${Date.now()}`);
 const form = page.getByTestId('chat-form'); const input = page.getByTestId('chat-input');
 await input.scrollIntoViewIfNeeded(); await input.blur();
 const before = await position(form); const fieldBefore = await position(input);
 await input.focus(); await input.fill('Premier message');
 expect(Math.abs((await position(input)).width - fieldBefore.width)).toBeLessThan(1);
 expect(Math.abs((await position(form)).y - before.y)).toBeLessThan(1);
 const font = await input.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize)); expect(font).toBeGreaterThanOrEqual(16);
 const photo = page.getByTestId('chat-photo-open'); const bounds = await position(photo);
 expect(bounds.x).toBeGreaterThanOrEqual(before.x); expect(bounds.x + bounds.width).toBeLessThanOrEqual(before.x + before.width);
 expect(bounds.width).toBeGreaterThanOrEqual(44);
 const chooser = page.waitForEvent('filechooser'); await photo.click(); expect((await chooser).isMultiple()).toBe(false);
 for (let i = 0; i < 3; i++) {
  await input.fill(`Message ${i} ` + 'Un message assez long pour remplir la discussion. '.repeat(8));
  await page.getByTestId('chat-send').click();
  await expect(input).toBeFocused();
  await expect(page.locator('[data-test-class="chat-message"]')).toHaveCount(i + 1);
 }
 await expect.poll(async () => Math.abs((await position(form)).y - before.y)).toBeLessThan(1);
 const thread = page.locator('[data-test-class="chat-thread"]');
 await expect.poll(() => thread.evaluate(e => e.scrollHeight > e.clientHeight)).toBe(true);
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
