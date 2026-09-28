import { test, expect } from './fixtures';

/** A 1x1 red pixel PNG, small enough to inline: nothing here depends on a real device photo. */
const FAKE_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321';

/**
 * Storage is mocked rather than hitting the local bucket: the upload and the signed-url calls are the only
 * network boundary this feature adds, and stubbing them keeps the spec about the chat flow (attach, show
 * inline, view full screen) instead of exercising Storage itself.
 */
function mockChatPhotoStorage(page: import('@playwright/test').Page) {
	let uploadedPath = '';

	const upload = page.route(`${SUPABASE_URL}/storage/v1/object/chat-photos/**`, async (route) => {
		uploadedPath = decodeURIComponent(new URL(route.request().url()).pathname.split('/chat-photos/')[1]);
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ Key: `chat-photos/${uploadedPath}` })
		});
	});

	const sign = page.route(`${SUPABASE_URL}/storage/v1/object/sign/chat-photos/**`, async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ signedURL: '/storage/v1/object/sign/chat-photos/fake-token' })
		});
	});

	const image = page.route('**/storage/v1/object/sign/chat-photos/fake-token**', async (route) => {
		await route.fulfill({ status: 200, contentType: 'image/png', body: FAKE_PNG });
	});

	return { upload, sign, image, uploadedPath: () => uploadedPath };
}

async function createList(page: import('@playwright/test').Page, name: string) {
	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(name);
	await page.getByTestId('list-create').click();

	await page.getByTestId('nav-/chat').click();
	await page.locator('[data-test-class="chat-entry"]').filter({ hasText: name }).click();
	await expect(page.getByTestId('chat-input')).toBeVisible();
}

test('envoyer une photo dans la discussion d’une liste, la voir en fil puis en plein écran', async ({
	signedInPage: page
}) => {
	const mocks = mockChatPhotoStorage(page);
	await Promise.all([mocks.upload, mocks.sign, mocks.image]);

	const name = `Repas photo e2e ${Date.now()}`;
	await createList(page, name);

	await page.getByTestId('chat-compose-open').click();
	await page.getByTestId('action-sheet-photo').click();

	await page.getByTestId('chat-photo-input').setInputFiles({
		name: 'plat.png',
		mimeType: 'image/png',
		buffer: FAKE_PNG
	});

	const photo = page.locator('[data-test-class="chat-message-photo"]').last();
	await expect(photo).toBeVisible({ timeout: 15_000 });
	await expect(page.getByTestId('chat-photo-uploading')).toHaveCount(0);
	await expect(page.getByTestId('chat-photo-error')).toHaveCount(0);

	// The scope segment of the stored path is the list, per the chat_photos_all storage policy.
	expect(mocks.uploadedPath()).toContain('/');

	await page.locator('[data-test-class="chat-message-photo-button"]').last().click();
	const viewer = page.getByTestId('chat-photo-viewer');
	await expect(viewer).toBeVisible();
	await expect(viewer.locator('img')).toBeVisible();

	await page.getByTestId('chat-photo-viewer-close').click();
	await expect(viewer).toBeHidden();

	// Still there after a reload — the photo path travelled through sync like the rest of the message.
	await page.reload();
	await expect(page.getByTestId('chat-input')).toBeVisible();
	await expect(page.locator('[data-test-class="chat-message-photo"]').last()).toBeVisible({ timeout: 15_000 });
});

test('une photo trop lourde est refusée sans être envoyée', async ({ signedInPage: page }) => {
	const name = `Repas photo trop lourde e2e ${Date.now()}`;
	await createList(page, name);

	await page.getByTestId('chat-compose-open').click();
	await page.getByTestId('action-sheet-photo').click();

	// A buffer bigger than CHAT_PHOTO_MAX_BYTES (25MB): no decoding, no upload attempt, no network call to mock.
	const tooBig = Buffer.alloc(26 * 1024 * 1024, 1);
	await page.getByTestId('chat-photo-input').setInputFiles({
		name: 'trop-lourd.png',
		mimeType: 'image/png',
		buffer: tooBig
	});

	await expect(page.getByTestId('chat-photo-error')).toBeVisible();
	await expect(page.locator('[data-test-class="chat-message-photo"]')).toHaveCount(0);
});
