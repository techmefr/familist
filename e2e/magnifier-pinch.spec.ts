import { test, expect } from './fixtures';

/**
 * Pinching a frozen frame (#469). Chromium can serve a fake camera stream, enough for the screen to go live,
 * be frozen and receive two real touch points; the zoom readout is what the gesture has to move. In a file of
 * its own because `launchOptions` must be set at the top level of a spec file.
 */
test.use({
	permissions: ['camera'],
	hasTouch: true,
	launchOptions: {
		args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
	}
});

test('deux doigts agrandissent l’image après le figement', async ({ signedInPage: page }) => {
	await page.goto('/magnifier');
	await expect(page.getByTestId('magnifier-video')).toBeVisible({ timeout: 15_000 });

	await page.getByTestId('magnifier-freeze').click();
	await expect(page.getByTestId('magnifier-frozen')).toBeVisible();

	const level = page.getByTestId('magnifier-level');
	const before = parseFloat((await level.textContent()) ?? '1');

	const box = (await page.getByTestId('magnifier-frozen').boundingBox())!;
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;
	const session = await page.context().newCDPSession(page);

	await session.send('Input.dispatchTouchEvent', {
		type: 'touchStart',
		touchPoints: [
			{ x: cx - 40, y: cy, id: 1 },
			{ x: cx + 40, y: cy, id: 2 }
		]
	});
	for (const spread of [70, 100, 130]) {
		await session.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [
				{ x: cx - spread, y: cy, id: 1 },
				{ x: cx + spread, y: cy, id: 2 }
			]
		});
	}
	await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

	await expect
		.poll(async () => parseFloat((await level.textContent()) ?? '1'))
		.toBeGreaterThan(before);
});
