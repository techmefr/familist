<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$utils';

	let {
		ref = $bindable(null),
		icon: Icon,
		class: className,
		children,
		...attributes
	}: HTMLAttributes<HTMLHeadingElement> & {
		ref?: HTMLHeadingElement | null;
		icon?: Component;
		children?: Snippet;
	} = $props();
</script>

<h1 bind:this={ref} class={cn('fl-page-title', className)} {...attributes}>
	{#if Icon}
		<span class="fl-page-symbol" aria-hidden="true"><Icon size={24} /></span>
	{/if}
	<span class="fl-page-title-text">{@render children?.()}</span>
</h1>
