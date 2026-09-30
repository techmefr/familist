<script lang="ts">
	import { t } from '$i18n/index.svelte';

	let { active, overlay = false }: { active: 'loupe' | 'product'; overlay?: boolean } = $props();

	const MODES = [
		{ id: 'loupe', href: '/magnifier', label: 'product.modeLoupe' },
		{ id: 'product', href: '/magnifier/product', label: 'product.modeProduct' }
	] as const;
</script>

<!--
	The Loupe tab holds two tools: the magnifier and the product scan. The choice sits at the top of both,
	plain links so the back button, the keyboard and a screen reader all behave.
-->
<nav
	aria-label={t('product.modes')}
	class="z-20 flex gap-1 rounded-full border p-1 {overlay
		? 'absolute start-1/2 top-3 -translate-x-1/2 bg-black/60 text-white backdrop-blur-md'
		: 'bg-card mx-auto w-fit'}"
	data-test-id="magnifier-modes"
>
	{#each MODES as mode (mode.id)}
		<a
			href={mode.href}
			aria-current={active === mode.id ? 'page' : undefined}
			data-test-id="magnifier-mode-{mode.id}"
			class="fl-press text-label flex min-h-[max(2.75rem,44px)] items-center rounded-full px-4 font-medium {active ===
			mode.id
				? 'bg-primary text-primary-foreground'
				: ''}"
		>
			{t(mode.label)}
		</a>
	{/each}
</nav>
