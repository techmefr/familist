<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import { toasts } from '$stores/toast.svelte';
	import type { Toast } from '$domain/toast';
	import { CircleAlert, CircleCheck, Info, LoaderCircle, X } from '@lucide/svelte';

	function act(toast: Toast) {
		toasts.dismiss(toast.id);
		toast.action?.run();
	}
</script>

<div
	class="fl-above-nav pointer-events-none z-50 flex flex-col gap-2 md:start-auto md:w-96"
	aria-live="polite"
	data-test-id="toaster"
>
	{#each toasts.items as toast (toast.id)}
		<div
			role={toast.tone === 'error' ? 'alert' : 'status'}
			data-test-class="toast"
			data-tone={toast.tone}
			class="fl-toast bg-card text-card-foreground pointer-events-auto rounded-xl border p-3 shadow-lg"
		>
			<div class="flex items-center gap-3">
				{#if toast.tone === 'error'}
					<CircleAlert size={22} class="text-destructive shrink-0" aria-hidden="true" />
				{:else if toast.tone === 'progress'}
					<LoaderCircle size={22} class="fl-toast-icon shrink-0 motion-safe:animate-spin" aria-hidden="true" />
				{:else if toast.tone === 'info'}
					<Info size={22} class="fl-toast-icon shrink-0" aria-hidden="true" />
				{:else}
					<CircleCheck size={22} class="fl-toast-icon shrink-0" aria-hidden="true" />
				{/if}
				<p class="text-label min-w-0 flex-1 [overflow-wrap:anywhere]">{toast.message}</p>
				<button
					type="button"
					onclick={() => toasts.dismiss(toast.id)}
					aria-label={t('common.close')}
					data-test-class="toast-close"
					class="fl-press text-muted-foreground hover:bg-muted grid min-h-[max(2.75rem,44px)] min-w-[44px] shrink-0 place-items-center rounded-full"
				>
					<X size={20} aria-hidden="true" />
				</button>
			</div>
			{#if toast.tone === 'progress'}
				<!-- The bar is only a picture of how far it went: the message already says what is going on. -->
				<div
					role="progressbar"
					aria-label={toast.message}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={Math.round((toast.progress ?? 0) * 100)}
					data-test-class="toast-progress"
					class="bg-muted mt-2 h-2 overflow-hidden rounded-full"
				>
					<div
						class="fl-toast-bar h-full rounded-full transition-[width]"
						style:width="{Math.round((toast.progress ?? 0) * 100)}%"
					></div>
				</div>
			{/if}
			{#if toast.action}
				<button
					type="button"
					onclick={() => act(toast)}
					data-test-class="toast-action"
					class="fl-press bg-primary text-primary-foreground text-label mt-2 min-h-[max(2.75rem,44px)] w-full rounded-lg px-4 font-semibold"
				>
					{toast.action.label}
				</button>
			{/if}
		</div>
	{/each}
</div>

<style>
 .fl-toast { --toast-color: var(--fl-info); border-inline-start: 4px solid var(--toast-color); }
 .fl-toast[data-tone='success'] { --toast-color: var(--fl-success); }
 .fl-toast[data-tone='error'] { --toast-color: var(--destructive); }
 .fl-toast :global(.fl-toast-icon) { color: var(--toast-color); }
 .fl-toast-bar { background: var(--toast-color); }
</style>
