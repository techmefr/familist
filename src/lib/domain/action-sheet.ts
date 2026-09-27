import type { Component } from 'svelte';

/** One row of `ActionSheet`: what it is called, what it opens, and whether it reads as a destructive choice. */
export interface Action {
	id: string;
	label: string;
	icon: Component;
	destructive?: boolean;
	onSelect: () => void;
}
