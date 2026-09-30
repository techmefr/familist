import { test, expect } from './fixtures';

/**
 * The notifications screen (#484). Push itself needs a native build and Firebase; what a browser can check is
 * the screen: an honest message where push does not exist, and the settings that are stored and come back.
 */
test('les notifications : message honnête sur le web, réglages conservés', async ({
	signedInPage: page
}) => {
	await page.goto('/profile/notifications');

	await expect(page.getByTestId('notifications-unsupported')).toBeVisible();
	await expect(page.getByTestId('notifications-enable')).toHaveCount(0);

	const chats = page.getByTestId('notify-chats');
	await chats.click();
	await expect(chats).not.toBeChecked();

	await page.getByTestId('quiet-start').fill('21:30');
	await page.getByTestId('quiet-start').blur();

	await page.reload();
	await expect(page.getByTestId('notify-chats')).not.toBeChecked();
	await expect(page.getByTestId('quiet-start')).toHaveValue('21:30');

	// Putting things back: the setting is saved on the fixed account, shared by the whole suite.
	await page.getByTestId('notify-chats').click();
	await page.getByTestId('quiet-start').fill('22:00');
	await page.getByTestId('quiet-start').blur();
});

test('une discussion de liste peut être mise en sourdine depuis son en-tête', async ({
	signedInPage: page
}) => {
	const name = `Sourdine ${Date.now()}`;

	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(name);
	await page.getByTestId('list-create').click();
	await page.getByTestId('nav-/chat').click();
	await page.locator('[data-test-class="chat-entry"]').filter({ hasText: name }).click();

	const mute = page.getByTestId('chat-mute-toggle');
	await expect(mute).toHaveAttribute('aria-pressed', 'false');
	await mute.click();
	await expect(mute).toHaveAttribute('aria-pressed', 'true');
});
