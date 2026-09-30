<script lang="ts">
	import { fade } from 'svelte/transition';
	import { motionMs } from '$stores/settings.svelte';
	import { DURATION } from '$domain/motion-tokens';
	import { t } from '$i18n/index.svelte';
	import { X } from '@lucide/svelte';

	let { url, alt, onClose }: { url: string; alt: string; onClose: () => void } = $props();
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') onClose();
	}}
/>

<!-- Minimal full-screen viewer: a black ground and the photo at its own aspect ratio, in the same spirit as
	CardFullscreen but with nothing else to show — a chat photo carries no data of its own to browse. -->
<div
	transition:fade={{ duration: motionMs(DURATION.tap) }}
	class="fixed inset-0 z-50 flex flex-col bg-black"
	role="dialog"
	aria-modal="true"
	aria-label={alt}
	data-test-id="chat-photo-viewer"
>
	<div class="flex items-center justify-end px-4 pt-6 pb-2">
		<button
			type="button"
			onclick={onClose}
			aria-label={t('common.close')}
			data-test-id="chat-photo-viewer-close"
			class="grid size-11 min-w-[44px] shrink-0 place-items-center rounded-full border border-white/20 bg-white/10"
		>
			<X size={20} aria-hidden="true" />
		</button>
	</div>

	<button
		type="button"
		onclick={onClose}
		aria-label={t('common.close')}
		class="flex min-h-0 flex-1 items-center justify-center p-4"
	>
		<img src={url} {alt} class="max-h-full max-w-full object-contain" />
	</button>
</div>
