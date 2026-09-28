<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { keyboardInset } from '$domain/keyboard-inset';
	import { Input } from '$components/ui/input';
	import IconField from '$components/app/IconField.svelte';
	import { Search, SlidersHorizontal, X } from '@lucide/svelte';

	let {
		query = $bindable(),
		active,
		onFilters,
		label,
		placeholder,
		testPrefix,
		height = $bindable(0)
	}: {
		query: string;
		/** How many filters are on, shown on the button so a narrowed list never looks like the whole one. */
		active: number;
		onFilters: () => void;
		/** The field's accessible name (announced, not drawn — the placeholder carries the visible hint). */
		label: string;
		placeholder: string;
		/** Prefixes every `data-test-id` this bar renders, so two instances on one page never collide. */
		testPrefix: string;
		/** The bar's own height: the page leaves that much room under its last item. */
		height?: number;
	} = $props();

	let field = $state<HTMLInputElement | null>(null);
	let focused = $state(false);
	let covered = $state(0);

	/**
	 * Android lays the keyboard over the page rather than shrinking it, so a bar fixed to the bottom ends up
	 * under the keys the moment the field it holds is tapped. `visualViewport` is what still knows how much
	 * of the screen is left.
	 */
	$effect(() => {
		const viewport = window.visualViewport;
		if (!viewport) return;

		const update = () => (covered = keyboardInset(window.innerHeight, viewport));
		update();
		viewport.addEventListener('resize', update);
		viewport.addEventListener('scroll', update);

		return () => {
			viewport.removeEventListener('resize', update);
			viewport.removeEventListener('scroll', update);
		};
	});

	/** Only for our own field: a keyboard opened elsewhere on the page must not lift the bar over what is typed. */
	const lifted = $derived(focused && covered > 0);

	function clear() {
		feedback.play('tap');
		query = '';
		field?.focus();
	}
</script>

<!--
	The app-wide thumb bar (#352): a search field paired with a Filters button, generalised from the recipes
	wall's own bar so every list-like screen shares one pattern instead of a header search icon or a toggled
	field of its own.

	On a phone it floats above the navigation bar, where the hand holding the phone already is, and stops
	before the create button so the two never overlap. From tablet width on, `fl-above-nav` puts it back in
	the flow, at the top of the list: the bottom of a large screen is far from the eye, and nothing there is
	held in one hand.

	It wraps rather than squeezing: at the largest text sizes the field takes a line of its own and the
	Filters button the next, full width, instead of both shrinking below a finger.
-->
<div
	bind:clientHeight={height}
	role="search"
	aria-label={label}
	data-keyboard={lifted ? 'open' : undefined}
	style="--fl-keyboard: {covered}px"
	class="fl-above-nav fl-dock fl-search-bar mt-4 flex flex-wrap items-center gap-1"
	data-test-id="{testPrefix}-bar"
>
	<div class="min-w-0 flex-[999_1_10rem]">
		<label for="{testPrefix}-search" class="sr-only">{label}</label>
		<IconField icon={Search}>
			<Input
				id="{testPrefix}-search"
				bind:ref={field}
				bind:value={query}
				type="search"
				enterkeyhint="search"
				autocomplete="off"
				{placeholder}
				onfocus={() => (focused = true)}
				onblur={() => (focused = false)}
				data-test-id="{testPrefix}-search"
				class="text-label h-[max(3rem,48px)] rounded-full [&::-webkit-search-cancel-button]:hidden"
			/>
			{#snippet action()}
				{#if query}
					<button
						type="button"
						onclick={clear}
						aria-label={t('common.clear')}
						data-test-id="{testPrefix}-search-clear"
						class="fl-press text-muted-foreground hover:bg-muted me-1 grid size-[max(2.75rem,44px)] place-items-center rounded-full"
					>
						<X size={20} aria-hidden="true" />
					</button>
				{/if}
			{/snippet}
		</IconField>
	</div>

	<button
		type="button"
		onclick={onFilters}
		aria-haspopup="dialog"
		data-test-id="{testPrefix}-filters-open"
		class="fl-press fl-search-bar-filters bg-muted text-foreground text-label flex min-h-[max(3rem,48px)] flex-[1_0_auto] items-center justify-center gap-2 rounded-full px-4 font-medium"
	>
		<SlidersHorizontal size={18} aria-hidden="true" />
		{t('common.filters')}
		{#if active > 0}
			<span
				class="bg-primary text-primary-foreground text-caption grid min-w-6 place-items-center rounded-full px-1.5 font-semibold"
				data-test-id="{testPrefix}-filters-count"
				aria-hidden="true"
			>
				{active}
			</span>
			<span class="sr-only">{t('common.filtersActive', { count: active })}</span>
		{/if}
	</button>
</div>
