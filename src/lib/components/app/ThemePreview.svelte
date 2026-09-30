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
	class="bg-background pointer-events-none grid h-14 w-full gap-1 overflow-hidden rounded-md border p-1.5"
	aria-hidden="true"
>
	<span class="bg-card flex items-center gap-1 rounded-sm px-1.5 py-1 shadow-sm">
		<span class="bg-primary size-2.5 rounded-full"></span>
		<span class="bg-foreground/70 h-1.5 w-8 rounded-full"></span>
	</span>
	<span class="flex gap-1">
		<span class="bg-primary h-3 w-10 rounded-full"></span>
		<span class="bg-accent h-3 w-6 rounded-full"></span>
		<span class="bg-secondary h-3 w-3 rounded-full"></span>
	</span>
</span>
