<script lang="ts">
	import type { LoyaltyCard } from '$db/schema';
	import { tintForWhiteText, DEFAULT_TINT } from '$domain/tint';
	import { t } from '$i18n/index.svelte';
	import BrandMark from './BrandMark.svelte';
	import { Users } from '@lucide/svelte';

	/**
	 * The face, reduced to what it takes to recognise and pick the right card at a glance: its colour, the
	 * chain's logo, its name, and the shop it belongs to. Everything else the old face carried — the
	 * gradient, the decorative ring, the barcode/QR icon, the "LOYALTY" caption — either repeated what the
	 * shape of the card already says, or belongs to the full-screen view where it is actually scanned.
	 *
	 * `actions` keeps the bottom of the card free for the menu button laid over it.
	 */
	let {
		card,
		shopName,
		shareCount = 0,
		actions = false
	}: {
		card: Pick<LoyaltyCard, 'name' | 'brand' | 'tint'>;
		shopName?: string;
		shareCount?: number;
		actions?: boolean;
	} = $props();
</script>

<article
	class="relative flex h-full min-h-[7.5rem] flex-col gap-3 rounded-lg p-4 text-white shadow-[var(--fl-shadow-2)] {actions
		? 'pb-14'
		: ''}"
	style="background: {tintForWhiteText(card.tint || DEFAULT_TINT)}"
	data-test-class="loyalty-card"
	data-tint={card.tint}
>
	<div class="flex items-start justify-between gap-2">
		<BrandMark name={card.name} brand={card.brand} tint={card.tint} />

		{#if shareCount > 0}
			<span
				class="text-caption flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2 py-1 font-semibold"
				data-test-class="card-share-badge"
				aria-label={t('cards.sharedCount', { count: shareCount })}
			>
				<Users size={13} aria-hidden="true" />
				{shareCount}
			</span>
		{/if}
	</div>

	<div class="mt-auto">
		<h2 class="text-product font-semibold hyphens-auto wrap-anywhere">{card.name}</h2>
		{#if shopName}
			<p class="text-caption text-white/80">{shopName}</p>
		{/if}
	</div>
</article>
