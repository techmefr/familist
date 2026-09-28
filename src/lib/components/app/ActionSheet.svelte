<script lang="ts">
	import { feedback } from '$stores/feedback.svelte';
	import type { Action } from '$domain/action-sheet';

	/**
	 * The action menu a long press opens: Edit, Delete, Share and whatever else a card, a list or a recipe
	 * needs, one sheet shared by all of them rather than a menu rebuilt per screen.
	 *
	 * `title` names what is being acted on ("Carte Carrefour"), read by the sheet's own heading and by a
	 * screen reader that lands on it without having felt the long press that opened it.
	 */
	let { title, actions }: { title: string; actions: Action[] } = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	export function show() {
		dialog?.showModal();
	}

	function hide() {
		dialog?.close();
	}

	function run(action: Action) {
		feedback.play('tap');
		hide();
		action.onSelect();
	}
</script>

<dialog
	bind:this={dialog}
	onclick={(event) => {
		if (event.target === dialog) hide();
	}}
	class="fl-sheet"
	aria-label={title}
	data-test-id="action-sheet"
>
	<div class="bg-card rounded-t-2xl border p-2 md:rounded-2xl">
		<p class="text-caption text-muted-foreground truncate px-3 pt-2 pb-1 font-medium">{title}</p>
		<ul>
			{#each actions as action (action.id)}
				{@const Icon = action.icon}
				<li>
					<button
						type="button"
						onclick={() => run(action)}
						data-test-class="action-sheet-item"
						data-test-id="action-sheet-{action.id}"
						class="fl-press text-label flex min-h-[max(2.75rem,44px)] w-full items-center gap-3 rounded-md px-3 text-start {action.destructive
							? 'text-destructive'
							: ''}"
					>
						<Icon size={18} aria-hidden="true" />
						{action.label}
					</button>
				</li>
			{/each}
		</ul>
	</div>
</dialog>
