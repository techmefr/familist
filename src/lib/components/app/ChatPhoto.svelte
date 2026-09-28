<script lang="ts">
	import { supabase } from '$db/supabase';
	import { t } from '$i18n/index.svelte';
	import ChatPhotoViewer from './ChatPhotoViewer.svelte';

	interface Props {
		photoPath: string;
		authorName: string;
	}

	let { photoPath, authorName }: Props = $props();

	/** How long a signed URL to a private bucket stays usable before the screen would need another one. */
	const SIGNED_URL_TTL_SECONDS = 3600;

	let signedUrl = $state<string | null>(null);
	let viewerOpen = $state(false);

	$effect(() => {
		let cancelled = false;

		supabase.storage
			.from('chat-photos')
			.createSignedUrl(photoPath, SIGNED_URL_TTL_SECONDS)
			.then(({ data: signed }) => {
				if (!cancelled) signedUrl = signed?.signedUrl ?? null;
			});

		return () => {
			cancelled = true;
		};
	});
</script>

{#if signedUrl}
	<button
		type="button"
		onclick={() => (viewerOpen = true)}
		aria-label={t('chat.photoView')}
		data-test-class="chat-message-photo-button"
		class="fl-press mt-1 block max-w-[min(85%,18rem)] overflow-hidden rounded-md border"
	>
		<img
			src={signedUrl}
			alt={t('chat.photoAlt', { name: authorName })}
			data-test-class="chat-message-photo"
			class="block max-h-72 w-full object-cover"
		/>
	</button>

	{#if viewerOpen}
		<ChatPhotoViewer url={signedUrl} alt={t('chat.photoAlt', { name: authorName })} onClose={() => (viewerOpen = false)} />
	{/if}
{/if}
