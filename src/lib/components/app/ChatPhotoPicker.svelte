<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { t } from '$i18n/index.svelte';
	import { CHAT_PHOTO_MAX_BYTES, CHAT_PHOTO_MAX_SIDE, CHAT_PHOTO_QUALITY } from '$domain/chat-photo';
	import { fitWithin } from '$domain/photo-resize';

	/**
	 * Sending a photo needs a connection (#366): unlike a typed message, there is no offline queue for it —
	 * the upload must succeed before a message ever exists to send. `busy` and `failed` are what the caller
	 * shows while that happens; the file input itself has no `capture` attribute, so the device's own picker
	 * offers both the camera and the gallery, exactly like choosing "camera or gallery" without two separate
	 * buttons.
	 */
	interface Props {
		scopeId: string;
		onUploaded: (path: string) => void;
	}

	let { scopeId, onUploaded }: Props = $props();

	let input = $state<HTMLInputElement | null>(null);
	let busy = $state(false);
	let failed = $state<'too-big' | 'upload' | null>(null);

	export function show() {
		failed = null;
		input?.click();
	}

	async function resized(file: File): Promise<Blob> {
		const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
		const size = fitWithin(bitmap.width, bitmap.height, CHAT_PHOTO_MAX_SIDE);
		const canvas = document.createElement('canvas');
		canvas.width = size.width;
		canvas.height = size.height;
		canvas.getContext('2d')?.drawImage(bitmap, 0, 0, size.width, size.height);
		bitmap.close();

		return new Promise((resolve, reject) =>
			canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode'))), 'image/jpeg', CHAT_PHOTO_QUALITY)
		);
	}

	async function choose(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (input) input.value = '';
		if (!file) return;

		failed = null;

		if (file.size > CHAT_PHOTO_MAX_BYTES) {
			failed = 'too-big';
			return;
		}

		busy = true;
		try {
			const photo = await resized(file);
			const outcome = await data.uploadChatPhoto(scopeId, photo);
			if (outcome.ok) onUploaded(outcome.path);
			else failed = 'upload';
		} catch {
			failed = 'upload';
		} finally {
			busy = false;
		}
	}
</script>

<input
	bind:this={input}
	type="file"
	accept="image/*"
	onchange={choose}
	aria-label={t('chat.composePhoto')}
	data-test-id="chat-photo-input"
	class="sr-only"
/>

{#if busy}
	<p class="text-muted-foreground text-caption mt-2" role="status" data-test-id="chat-photo-uploading">
		{t('chat.photoUploading')}
	</p>
{:else if failed}
	<p class="text-destructive text-caption mt-2" role="alert" data-test-id="chat-photo-error">
		{failed === 'too-big' ? t('chat.photoTooBig') : t('chat.photoFailed')}
	</p>
{/if}
