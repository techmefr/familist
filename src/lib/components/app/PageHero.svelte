<script lang="ts">
	import type { Component } from 'svelte';
	import PageHeading from './PageHeading.svelte';
	let { title, description, icon, items = [] }: {
		title: string;
		description?: string;
		icon?: Component;
		items?: { label: string; value: string | number }[];
	} = $props();
</script>

<header class="fl-screen-hero">
	<div class="fl-screen-hero-title">
		<PageHeading {icon}>{title}</PageHeading>
		{#if description}<p>{description}</p>{/if}
	</div>
	{#if items.length}
		<dl class="fl-screen-metrics">
			{#each items as item (item.label)}
				<div><dt>{item.label}</dt><dd>{item.value}</dd></div>
			{/each}
		</dl>
	{/if}
</header>
