<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { data } from '$stores/data.svelte';
	import { ai } from '$stores/ai.svelte';
	import { recipeDraft } from '$stores/recipe-draft.svelte';
	import { t } from '$i18n/index.svelte';
	import type { RecipeDraft } from '$domain/recipe-draft';
	import AiRecipeRequest from '$components/app/AiRecipeRequest.svelte';
	import { Button } from '$components/ui/button';
	import { ChevronLeft, KeyRound } from '@lucide/svelte';

	/**
	 * "Adapt for my table" arrives as `?adapt=<recipe id>`: the field starts with the request, written from
	 * the recipe. The person reads it, changes it if they like, and sends it: nothing leaves on its own.
	 */
	const initialMessage = $derived.by(() => {
		const id = page.url.searchParams.get('adapt');
		const recipe = id ? data.recipes.find(candidate => candidate.id === id) : undefined;
		if (!recipe) return '';

		const ingredients = data.ingredientsOf(recipe.id).map(line => line.name).join(', ');
		return t('chat.adaptRequest', { name: recipe.name, ingredients });
	});

	/** A kept suggestion goes to the recipe form as a draft: nothing is ever saved from the chat. */
	async function useDraft(draft: RecipeDraft) {
		recipeDraft.offer(draft);
		await goto('/recipes');
	}
</script>

<svelte:head>
	<title>{t('chat.assistantTitle')} — {t('app.name')}</title>
</svelte:head>

<a
	href="/chat"
	data-test-id="assistant-back"
	class="fl-press text-primary text-label -ms-2 mb-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-medium"
>
	<ChevronLeft size={22} aria-hidden="true" class="rtl:rotate-180" />
	{t('chat.assistantBack')}
</a>

<h1 class="text-h1 font-semibold">{t('chat.assistantTitle')}</h1>

<div class="mt-4" data-test-id="assistant-panel">
	{#if !ai.configured}
		<div class="bg-card space-y-3 rounded-xl border p-4" data-test-id="assistant-needs-key">
			<p class="text-label flex items-center gap-2 font-semibold">
				<KeyRound size={18} aria-hidden="true" />
				{t('recipes.create.needsKey')}
			</p>
			<p class="text-label">{t('recipes.create.needsKeyBody')}</p>
			<Button href="/profile/ai" class="fl-press">{t('recipes.create.needsKeyLink')}</Button>
		</div>
	{:else}
		{#key initialMessage}
			<AiRecipeRequest onDraft={useDraft} {initialMessage} />
		{/key}
	{/if}
</div>
