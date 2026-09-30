<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { sync } from '$sync/index.svelte';
	import { motionMs } from '$stores/settings.svelte';
	import { DURATION } from '$domain/motion-tokens';
	import { t } from '$i18n/index.svelte';
	import { CloudOff, TriangleAlert } from '@lucide/svelte';

	/**
	 * Nothing to show when all is well: the application is made to be used while walking, and a permanent
	 * banner would only add clutter. We speak only of the two cases where the user needs to know that what
	 * they are doing has not left yet.
	 *
	 * The pill floats above the page instead of sitting in the flow: pushing the content down under the finger
	 * makes people miss the target they were aiming at. The local write has already succeeded whatever the
	 * state says, hence the wording: the data is safe, only the trip to the server is pending.
	 */
	const trouble = $derived(sync.state === 'offline' || sync.state === 'error');
	const isError = $derived(sync.state === 'error');

	let isRetrying = $state(false);
	let isDetailsOpen = $state(false);

	async function retry(): Promise<void> {
		if (isRetrying) return;
		isRetrying = true;
		try {
			await sync.flush();
		} finally {
			isRetrying = false;
		}
	}
</script>

{#if trouble}
	<div
		transition:fly={{ y: -12, duration: motionMs(DURATION.enter), easing: cubicOut }}
		class="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)]"
	>
		<div
			class="text-caption bg-card text-foreground pointer-events-auto flex max-w-full flex-col gap-2 rounded-2xl border px-4 py-2 shadow-md"
			role="status"
			data-test-id="sync-status"
		>
			<div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
				{#if isError}
					<TriangleAlert size={16} class="text-destructive shrink-0" aria-hidden="true" />
					<span>{t('sync.error')}</span>
				{:else}
					<CloudOff size={16} class="shrink-0" aria-hidden="true" />
					<span>{t('sync.offline')}</span>
				{/if}

				{#if isError}
					<button
						type="button"
						class="text-primary min-h-11 px-2 font-medium underline disabled:opacity-60"
						disabled={isRetrying}
						onclick={retry}
						data-test-id="sync-retry"
					>
						{isRetrying ? t('sync.retrying') : t('sync.retryNow')}
					</button>
				{/if}

				{#if isError && sync.lastError}
					<button
						type="button"
						class="text-muted-foreground min-h-11 px-2 underline"
						aria-expanded={isDetailsOpen}
						onclick={() => (isDetailsOpen = !isDetailsOpen)}
						data-test-id="sync-details-toggle"
					>
						{t('sync.details')}
					</button>
				{/if}
			</div>

			{#if isError && isDetailsOpen && sync.lastError}
				<p class="text-muted-foreground break-words" data-test-id="sync-details">
					{sync.lastError}
				</p>
			{/if}
		</div>
	</div>
{/if}
