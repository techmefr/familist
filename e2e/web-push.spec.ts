import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

async function mockBrowser(page: Page) {
 await page.addInitScript(() => {
  let permission: NotificationPermission = 'default';
  Object.defineProperty(Notification, 'permission', { configurable: true, get: () => permission });
  Object.defineProperty(Notification, 'requestPermission', { configurable: true, value: async () => { permission = 'granted'; return permission; } });
  Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} });
  const subscription = { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/token', keys: { p256dh: 'A'.repeat(87), auth: 'B'.repeat(22) } }) };
  Object.defineProperty(navigator.serviceWorker, 'getRegistration', { configurable: true, value: async () => ({ pushManager: { getSubscription: async () => null, subscribe: async (options: { userVisibleOnly: boolean }) => { if (!options.userVisibleOnly) throw new Error('visible only'); return subscription; } } }) });
 });
}
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info' };

test('PWA : autorisation explicite puis abonnement navigateur', { tag: '@critical' }, async ({ signedInPage: page }) => {
 await mockBrowser(page);
 await page.route('**/functions/v1/web-push-config', route => route.fulfill({ json: { publicKey: 'B'.repeat(87) }, headers }));
 let saved: Record<string, unknown> | undefined;
 await page.route('**/rest/v1/push_tokens*', route => {
  if (route.request().method() === 'POST') saved = route.request().postDataJSON();
  return route.fulfill({ status: 204, headers });
 });
 await page.goto('/profile/notifications');
 await expect(page.getByTestId('notifications-enable')).toBeVisible();
 expect(saved).toBeUndefined();
 await page.getByTestId('notifications-enable').click();
 await expect(page.getByTestId('notifications-granted')).toBeVisible();
 expect(saved?.platform).toBe('web');
 expect(JSON.parse(String(saved?.token)).endpoint).toBe('https://fcm.googleapis.com/token');
});

test('PWA : pas de faux succès si le serveur push est indisponible', { tag: '@critical' }, async ({ signedInPage: page }) => {
 await mockBrowser(page);
 await page.route('**/functions/v1/web-push-config', route => route.fulfill({ status: 503, json: { error: 'Not configured' }, headers }));
 await page.goto('/profile/notifications');
 await page.getByTestId('notifications-enable').click();
 await expect(page.getByTestId('notifications-registration-error')).toBeVisible();
 await expect(page.getByTestId('notifications-granted')).toHaveCount(0);
});
