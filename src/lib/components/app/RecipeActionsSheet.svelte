<script lang="ts">
	import { settings } from '$stores/settings.svelte';
	import { t } from '$i18n/index.svelte';
	import { Button } from '$components/ui/button';
	import { X, Pencil, ImagePlus, ShoppingBasket, Trash2, Copy } from '@lucide/svelte';

	/**
	 * The quick-actions sheet a recipe card opens on long-press (#373): editing, adding a photo, generating
	 * a list and deleting no longer sit as a row of buttons on every card in the wall — a Pinterest-style
	 * grid this dense has no room for four buttons per tile, and most taps on a card are to read it, not to
	 * change it. A visible "more" button opens the same sheet, since a gesture nobody can see is not a
	 * gesture a screen reader or a keyboard user can trigger either.
	 */
	let {
		recipeName,
		owned,
		onEdit,
		onPhoto,
		onGenerate,
		onDelete
	}: {
		recipeName: string;
		owned: boolean;
		onEdit: () => void;
		onPhoto: () => void;
		onGenerate: () => void;
		onDelete: () => void;
	} = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	export function show() {
		dialog?.showModal();
	}

	export function hide() {
		dialog?.close();
	}

	function run(action: () => void) {
		hide();
		action();
	}
</script>

<dialog
	bind:this={dialog}
	onclick={(event) => {
		if (event.target === dialog) hide();
	}}
	class="fl-sheet"
	aria-labelledby="recipe-actions-title"
	data-test-id="recipe-actions-sheet"
>
	<div class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl" class:fl-rise={settings.animates}>
		<h2 id="recipe-actions-title" class="text-h2 pe-12 font-semibold break-words">{recipeName}</h2>

		<div class="mt-4 flex flex-col gap-2">
			{#if owned}
				<Button
					variant="outline"
					onclick={() => run(onEdit)}
					data-test-id="recipe-actions-edit"
					class="fl-press h-auto min-h-14 w-full justify-start py-2"
				>
					<Pencil size={20} aria-hidden="true" />
					{t('common.edit')}
				</Button>

				<Button
					variant="outline"
					onclick={() => run(onPhoto)}
					data-test-id="recipe-actions-photo"
					class="fl-press h-auto min-h-14 w-full justify-start py-2"
				>
					<ImagePlus size={20} aria-hidden="true" />
					{t('recipes.addPhotoAction')}
				</Button>
			{:else}
				<Button
					variant="outline"
					onclick={() => run(onEdit)}
					data-test-id="recipe-actions-edit-copy"
					class="fl-press h-auto min-h-14 w-full justify-start py-2"
				>
					<Copy size={20} aria-hidden="true" />
					{t('recipes.editCopy')}
				</Button>
			{/if}

			<Button
				variant="outline"
				onclick={() => run(onGenerate)}
				data-test-id="recipe-actions-generate"
				class="fl-press h-auto min-h-14 w-full justify-start py-2"
			>
				<ShoppingBasket size={20} aria-hidden="true" />
				{t('recipes.generate')}
			</Button>

			{#if owned}
				<Button
					variant="destructive"
					onclick={() => run(onDelete)}
					data-test-id="recipe-actions-delete"
					class="fl-press h-auto min-h-14 w-full justify-start py-2"
				>
					<Trash2 size={20} aria-hidden="true" />
					{t('common.delete')}
				</Button>
			{/if}
		</div>

		<button
			type="button"
			onclick={hide}
			aria-label={t('common.close')}
			data-test-id="recipe-actions-close"
			class="fl-press text-muted-foreground hover:bg-muted absolute end-3 top-3 grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
		>
			<X size={22} aria-hidden="true" />
		</button>
	</div>
</dialog>
