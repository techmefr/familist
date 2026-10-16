import { test, expect } from './fixtures';

test('le scan Android utilise le moteur local et libère la caméra à l’arrêt', { tag: '@critical' }, async ({ signedInPage: page }) => {
 await page.addInitScript(() => {
  Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (Linux; Android 14) FamilistCameraCI' });
  Object.defineProperty(window, 'BarcodeDetector', { configurable: true, value: class { constructor() { throw new Error('Google detector must not be called'); } } });
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
   const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
   const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 320, 240);
   const stream = canvas.captureStream(5);
   const timer = setInterval(() => ctx.fillRect(0, 0, 320, 240), 100);
   stream.getVideoTracks()[0].addEventListener('ended', () => clearInterval(timer));
   Reflect.set(window, 'cameraTestStream', stream); return stream;
  } });
 });
 await page.goto('/cards'); await page.getByTestId('nav-create').click(); await page.getByTestId('create-card').click();
 await page.getByTestId('scan-start').click();
 await expect(page.getByTestId('scan-video')).toBeVisible();
 await expect.poll(() => page.evaluate(() => Boolean(Reflect.get(window, 'cameraTestStream')))).toBe(true);
 await page.getByTestId('scan-stop').click();
 await expect(page.getByTestId('scan-video')).toHaveCount(0);
 await expect.poll(() => page.evaluate(() => (Reflect.get(window, 'cameraTestStream') as MediaStream).getTracks().every(track => track.readyState === 'ended'))).toBe(true);
 await expect(page.getByTestId('scan-error')).toHaveCount(0);
});

test('une caméra refusée conserve les solutions photo et import', { tag: '@critical' }, async ({ signedInPage: page }) => {
 await page.addInitScript(() => {
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => { throw new DOMException('Denied', 'NotAllowedError'); } });
 });
 await page.goto('/cards'); await page.getByTestId('nav-create').click(); await page.getByTestId('create-card').click();
 await page.getByTestId('scan-start').click();
 await expect(page.getByTestId('scan-error')).toBeVisible();
 await expect(page.getByTestId('scan-start')).toBeEnabled();
 await expect(page.getByTestId('import-code')).toBeVisible();
});

test('sans API caméra la photo, l’import et la saisie restent accessibles', { tag: '@critical' }, async ({ signedInPage: page }) => {
 await page.addInitScript(() => Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined }));
 await page.goto('/cards'); await page.getByTestId('nav-create').click(); await page.getByTestId('create-card').click();
 await expect(page.getByTestId('scan-start')).toHaveCount(0);
 await expect(page.getByTestId('capture-photo')).toBeVisible();
 await expect(page.getByTestId('import-code')).toBeVisible();
});
