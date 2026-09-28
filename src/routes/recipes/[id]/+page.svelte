<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { t } from '$i18n/index.svelte';
	import { DEFAULT_SERVINGS, MAX_SERVINGS, MIN_SERVINGS } from '$domain/recipe';
	import { unitKeyForCount } from '$domain/units';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import IconField from '$components/app/IconField.svelte';
	import RecipePhoto from '$components/app/RecipePhoto.svelte';
	import RecipeShareSheet from '$components/app/RecipeShareSheet.svelte';
	import RecipeTagChips from '$components/app/RecipeTagChips.svelte';
	import CookAlong from '$components/app/CookAlong.svelte';
	import {
		ArrowLeft,
		CookingPot,
		Hash,
		NotebookPen,
		Pencil,
		Share2,
		ShoppingBasket,
		Trash2,
		Users,
		UtensilsCrossed,
		Copy,
		Mic
	} from '@lucide/svelte';

	/**
	 * A recipe's own page (#373): tapping a card in the wall used to unfold it in place; it now opens here
	 * instead, with a transition and real back navigation, and room for everything a recipe holds without
	 * fighting a Pinterest grid for space.
	 */
	const recipeId = $derived(page.params.id!);
	const recipe = $derived(data.recipe(recipeId));
	const owned = $derived(recipe?.householdId === data.circle);
	const ingredients = $derived(data.ingredientsOf(recipeId));
	const steps = $derived(data.stepsOf(recipeId));

	let shareSheet = $state<RecipeShareSheet | null>(null);
	let cookAlongOpen = $state(false);
	let generating = $state(false);
	let guestCount = $state(DEFAULT_SERVINGS);
	let target = $state('');
	let toDelete = $state(false);

	function startGenerate() {
		generating = true;
		guestCount = recipe?.servings ?? DEFAULT_SERVINGS;
		target = '';
	}

	async function generate() {
		const issue = data.generateList(recipeId, guestCount, target || undefined);
		if (!issue) return;

		feedback.play('add');
		generating = false;
		await goto(`/l/${issue.listId}`);
	}

	async function remove() {
		feedback.play('remove');
		data.removeRecipe(recipeId);
		await goto('/recipes');
	}
</script>

<svelte:head>
	<title>{recipe?.name ?? t('recipes.title')} — {t('app.name')}</title>
</svelte:head>

<a
	href="/recipes"
	class="text-muted-foreground text-label inline-flex min-h-[max(2.75rem,44px)] items-center gap-2"
>
	<ArrowLeft size={16} aria-hidden="true" />
	{t('recipes.backToRecipes')}
</a>

{#if !data.ready}
	<p class="text-muted-foreground mt-4">{t('common.loading')}</p>
{:else if !recipe}
	<p class="text-muted-foreground mt-4" data-test-id="recipe-not-found">{t('recipes.notFound')}</p>
{:else}
	<div class="mt-2 space-y-5" data-test-id="recipe-detail">
		<div class="flex flex-wrap items-start gap-2">
			<h1 class="text-h1 min-w-0 flex-1 font-semibold break-words">{recipe.name}</h1>
			<span
				class="bg-primary text-primary-foreground text-caption mt-1 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
				aria-label={t('recipes.servingsCount', { count: recipe.servings })}
			>
				<UtensilsCrossed size={12} aria-hidden="true" />
				<span aria-hidden="true">{recipe.servings}</span>
			</span>
			{#if !owned}
				<span
					class="bg-muted text-muted-foreground text-caption mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold"
					data-test-class="recipe-shared-badge"
				>
					{t('recipes.sharedFrom', { circle: data.circleName(recipe.householdId) })}
				</span>
			{/if}
		</div>

		<RecipeTagChips tags={recipe.tags} />

		<RecipePhoto
			recipeId={recipe.id}
			recipeName={recipe.name}
			ingredientNames={ingredients.map((line) => line.name)}
			photoPath={recipe.photoPath}
			imagePrompt={recipe.imagePrompt}
		/>

		{#if ingredients.length}
			<div>
				<h2 class="text-label text-muted-foreground flex items-center gap-1.5 font-semibold tracking-wide uppercase">
					<ShoppingBasket size={14} aria-hidden="true" />
					{t('recipes.step.ingredients')}
				</h2>
				<ul class="text-label mt-2 space-y-1.5">
					{#each ingredients as ingredient (ingredient.id)}
						<li
							data-test-class="recipe-ingredient"
							class="flex items-baseline gap-2 border-b border-dashed pb-1.5 last:border-0 last:pb-0"
						>
							<span class="min-w-0 flex-1">{ingredient.name}</span>
							{#if ingredient.qty}
								<span class="text-muted-foreground text-caption shrink-0 font-medium">
									{ingredient.qty}
									{t(unitKeyForCount(ingredient.unit, ingredient.qty) ?? `units.${ingredient.unit}`)}
								</span>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if recipe.notes}
			<div>
				<h2 class="text-label text-muted-foreground flex items-center gap-1.5 font-semibold tracking-wide uppercase">
					<NotebookPen size={14} aria-hidden="true" />
					{t('recipes.notes')}
				</h2>
				<p class="text-label mt-2 whitespace-pre-line" data-test-class="recipe-notes-body">{recipe.notes}</p>
			</div>
		{/if}

		{#if steps.length}
			<div>
				<h2 class="text-label text-muted-foreground flex items-center gap-1.5 font-semibold tracking-wide uppercase">
					<CookingPot size={14} aria-hidden="true" />
					{t('recipes.step.steps')}
				</h2>
				<!--
					"Cooking mode" reading: a step is looked at with wet or floury hands, from arm's length, one at a
					time — so the number carries the weight, not the bullet.
				-->
				<ol class="mt-2 space-y-3">
					{#each steps as step, index (step.id)}
						<li data-test-class="recipe-step-body" class="flex items-start gap-3">
							<span
								class="bg-muted text-foreground text-label grid size-7 shrink-0 place-items-center rounded-full font-bold"
								aria-hidden="true"
							>
								{index + 1}
							</span>
							<span class="text-label pt-0.5">{step.body}</span>
						</li>
					{/each}
				</ol>

				<Button
					onclick={() => (cookAlongOpen = true)}
					data-test-class="recipe-cook-along"
					class="fl-press mt-3 w-full"
				>
					<Mic size={18} aria-hidden="true" />
					{t('recipes.cookAlong.start')}
				</Button>
			</div>
		{/if}

		<div class="flex flex-wrap items-center gap-3 border-t pt-4">
			<Button
				onclick={startGenerate}
				disabled={ingredients.length === 0}
				data-test-class="recipe-generate"
				class="fl-press"
			>
				<ShoppingBasket size={18} aria-hidden="true" />
				{t('recipes.generate')}
			</Button>

			{#if owned}
				<Button
					variant="outline"
					onclick={() => goto(`/recipes?edit=${recipe.id}`)}
					aria-label={t('recipes.edit', { name: recipe.name })}
					data-test-class="recipe-edit"
					class="fl-press"
				>
					<Pencil size={18} aria-hidden="true" />
					{t('common.edit')}
				</Button>

				<Button
					variant="outline"
					onclick={() => shareSheet?.show()}
					aria-label={t('recipes.shareAria', { name: recipe.name })}
					data-test-class="recipe-share"
					class="fl-press"
				>
					<Share2 size={18} aria-hidden="true" />
					{t('recipes.share')}
				</Button>

				<Button
					variant="destructive"
					onclick={() => (toDelete = true)}
					aria-label={t('recipes.delete', { name: recipe.name })}
					data-test-class="recipe-delete"
					class="fl-press"
				>
					<Trash2 size={18} aria-hidden="true" />
					{t('common.delete')}
				</Button>
			{:else}
				<Button
					variant="outline"
					onclick={() => goto(`/recipes?edit=${recipe.id}`)}
					aria-label={t('recipes.editCopyAria', { name: recipe.name })}
					data-test-class="recipe-edit-copy"
					class="fl-press"
				>
					<Copy size={18} aria-hidden="true" />
					{t('recipes.editCopy')}
				</Button>
			{/if}
		</div>

		{#if generating}
			<div class="space-y-3 border-t pt-4" data-test-class="recipe-generate-form">
				<div>
					<Label for="generate-people">{t('recipes.people')}</Label>
					<IconField icon={Users}>
						<Input
							id="generate-people"
							type="number"
							bind:value={guestCount}
							min={MIN_SERVINGS}
							max={MAX_SERVINGS}
							data-test-class="generate-people"
						/>
					</IconField>
					<p class="text-muted-foreground text-caption">
						{t('recipes.peopleHint', { servings: recipe.servings })}
					</p>
				</div>

				<div>
					<Label for="generate-target">{t('recipes.target')}</Label>
					<IconField icon={Hash}>
						<select
							id="generate-target"
							bind:value={target}
							data-test-class="generate-target"
							class="border-input bg-background min-h-[max(2.75rem,44px)] w-full rounded-md border"
						>
							<option value="">{t('recipes.targetNew')}</option>
							{#each data.lists as list (list.id)}
								<option value={list.id}>{list.emoji} {list.name}</option>
							{/each}
						</select>
					</IconField>
				</div>

				<div class="flex flex-wrap gap-2">
					<Button onclick={generate} data-test-class="generate-submit" class="fl-press">
						<ShoppingBasket size={18} aria-hidden="true" />
						{t('recipes.generateSubmit')}
					</Button>
					<Button variant="outline" onclick={() => (generating = false)} class="fl-press">
						{t('common.cancel')}
					</Button>
				</div>
			</div>
		{/if}

		{#if toDelete}
			<div class="space-y-3 border-t pt-4">
				<p class="text-label">{t('recipes.deleteConfirm', { name: recipe.name })}</p>
				<div class="flex flex-wrap gap-2">
					<Button variant="destructive" onclick={remove} data-test-class="recipe-delete-confirm" class="fl-press">
						{t('recipes.deleteYes')}
					</Button>
					<Button variant="outline" onclick={() => (toDelete = false)} class="fl-press">
						{t('common.cancel')}
					</Button>
				</div>
			</div>
		{/if}
	</div>

	<RecipeShareSheet bind:this={shareSheet} recipeId={recipe.id} />

	{#if cookAlongOpen}
		<CookAlong
			recipeName={recipe.name}
			steps={steps.map((step) => step.body)}
			ingredients={data.ingredientsOf(recipe.id)}
			stepIngredientIds={steps.map((step) => step.ingredientIds ?? [])}
			recipeId={recipe.id}
			stepDurations={steps.map((step) => step.durationSeconds ?? null)}
			onClose={() => (cookAlongOpen = false)}
		/>
	{/if}
{/if}
