<script lang="ts">
	import type { CustomTheme } from '$domain/custom-theme';

	let { themeId, custom = null }: { themeId: string; custom?: CustomTheme | null } = $props();

	const style = $derived(
		custom
			? Object.entries(custom.tokens)
					.map(([name, value]) => `--${name}:${value}`)
					.join(';') + `;--radius:${custom.radius}rem`
			: undefined
	);
</script>

<!--
	A miniature of the screen drawn with the theme's own tokens, scoped by `data-theme-preview`, so choosing a
	palette is seeing it rather than reading its name. Purely decorative: the option's label carries the name.
-->
<span
	data-theme-preview={custom ? undefined : themeId}
	{style}
	class="bg-background pointer-events-none grid h-[56px] w-full min-w-0 gap-1 overflow-hidden rounded-md border p-[6px]"
	aria-hidden="true"
>
	<span class="bg-card flex min-w-0 items-center gap-1 overflow-hidden rounded-sm px-[6px] py-1 shadow-sm">
		<span class="bg-primary size-[10px] shrink-0 rounded-full"></span>
		<span class="bg-foreground/70 h-[6px] w-[32px] shrink-0 rounded-full"></span>
	</span>
	<span class="flex min-w-0 gap-1 overflow-hidden">
		<span class="bg-primary h-[12px] w-[40px] shrink-0 rounded-full"></span>
		<span class="bg-accent h-[12px] w-[24px] shrink-0 rounded-full"></span>
		<span class="bg-secondary size-[12px] shrink-0 rounded-full"></span>
	</span>
</span>
