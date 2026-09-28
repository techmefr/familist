<script lang="ts">
	import { supabase } from '$db/supabase';
	import { t } from '$i18n/index.svelte';
	import { Button } from '$components/ui/button';
	import RecipeImagePicker from './RecipeImagePicker.svelte';
	import { ImagePlus, Pencil } from '@lucide/svelte';

	interface Props {
		recipeId: string;
		recipeName: string;
		ingredientNames: string[];
		photoPath?: string;
		imagePrompt?: string;
		/** The edit form's own top-of-page thumbnail (#400), instead of the full-width block the detail page shows. */
		compact?: boolean;
	}

	let { recipeId, recipeName, ingredientNames, photoPath, imagePrompt, compact = false }: Props =
		$props();

	/** How long a signed URL to a private bucket stays usable before the screen would need another one. */
	const SIGNED_URL_TTL_SECONDS = 3600;

	let signedUrl = $state<string | null>(null);
	let picker = $state<RecipeImagePicker | null>(null);

	$effect(() => {
		if (!photoPath) {
			signedUrl = null;
			return;
		}

		let cancelled = false;

		supabase.storage
			.from('recipe-photos')
			.createSignedUrl(photoPath, SIGNED_URL_TTL_SECONDS)
			.then(({ data: signed }) => {
				if (!cancelled) signedUrl = signed?.signedUrl ?? null;
			});

		return () => {
			cancelled = true;
		};
	});
</script>

{#if compact}
	<!--
		The edit form's own thumbnail (#400): a square the size of the emoji picker beside it, not the
		full-width block the detail page shows further down for actually looking at the photo. Tapping the
		thumbnail itself opens the same picker as the button used to - one target, not two.
	-->
	<button
		type="button"
		onclick={() => picker?.show()}
		aria-haspopup="dialog"
		data-test-class="recipe-photo-button"
		class="fl-press border-input bg-background relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border"
	>
		{#if signedUrl}
			<img
				src={signedUrl}
				alt={t('recipes.photoAlt', { name: recipeName })}
				data-test-class="recipe-photo"
				class="size-full object-cover"
			/>
			<span
				class="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-white"
				aria-hidden="true"
			>
				<Pencil size={14} class="mx-auto" />
			</span>
		{:else}
			<ImagePlus size={22} aria-hidden="true" class="text-muted-foreground" />
		{/if}
		<span class="sr-only">{photoPath ? t('ai.photoChange') : t('ai.photoAdd')}</span>
	</button>
{:else}
	<div class="mb-3 space-y-2" data-test-class="recipe-photo-generate">
		{#if signedUrl}
			<img
				src={signedUrl}
				alt={t('recipes.photoAlt', { name: recipeName })}
				data-test-class="recipe-photo"
				class="aspect-video w-full rounded-lg object-cover"
			/>
		{/if}
		<Button
			variant="outline"
			onclick={() => picker?.show()}
			aria-haspopup="dialog"
			data-test-class="recipe-photo-button"
			class="fl-press h-auto min-h-11 w-full px-4 py-2 text-base whitespace-normal [overflow-wrap:normal]"
		>
			<ImagePlus size={18} aria-hidden="true" />
			{photoPath ? t('ai.photoChange') : t('ai.photoAdd')}
		</Button>
	</div>
{/if}

<RecipeImagePicker bind:this={picker} {recipeId} {recipeName} {ingredientNames} {photoPath} {imagePrompt} />
