<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { ai } from '$stores/ai.svelte';
	import { recipeDraft } from '$stores/recipe-draft.svelte';
	import { t } from '$i18n/index.svelte';
	import { motionMs, settings } from '$stores/settings.svelte';
	import { DEFAULT_SERVINGS, MAX_SERVINGS, MIN_SERVINGS, type RecipeLine } from '$domain/recipe';
	import type { Recipe } from '$db/schema';
	import { DEFAULT_EMOJI, type RecipeDraft } from '$domain/recipe-draft';
	import { UNITS, DEFAULT_UNIT } from '$domain/units';
	import { toggleLink, withoutIngredient } from '$domain/step-ingredients';
	import { durationFields, durationFromFields } from '$domain/step-duration';
	import { knownTags } from '$domain/recipe-tags';
	import { activeCount, emptySelection, findRecipes, totalSeconds } from '$domain/recipe-filter';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import * as Card from '$components/ui/card';
	import { tick, untrack } from 'svelte';
	import EmojiPicker from '$components/app/EmojiPicker.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';
	import IconField from '$components/app/IconField.svelte';
	import RecipePhoto from '$components/app/RecipePhoto.svelte';
	import RecipeShareSheet from '$components/app/RecipeShareSheet.svelte';
	import RecipeCover from '$components/app/RecipeCover.svelte';
	import RecipeTagPicker from '$components/app/RecipeTagPicker.svelte';
	import RecipeTagChips from '$components/app/RecipeTagChips.svelte';
	import SearchFilterBar from '$components/app/SearchFilterBar.svelte';
	import StepWidgetsEditor from '$components/app/StepWidgetsEditor.svelte';
	import { parseWidgets, type StepWidget } from '$domain/step-widgets';
	import RecipeFilterSheet from '$components/app/RecipeFilterSheet.svelte';
	import {
		CookingPot,
		Hash,
		Plus,
		ShoppingBasket,
		Trash2,
		Users,
		UtensilsCrossed,
		ChevronLeft,
		ChevronRight,
		Check,
		CalendarDays,
		MoreVertical
	} from '@lucide/svelte';
	import RecipeActionsSheet from '$components/app/RecipeActionsSheet.svelte';
	import { longpress } from '$components/app/longpress.svelte';

	/**
	 * The three stages of typing. A whole recipe rarely fits on a phone screen, and asking everything at
	 * once — the name, ten ingredients, six steps — gives a form you close before starting it. So we ask
	 * what it is, then what to buy, then how you go about it: the order a recipe is really written in.
	 *
	 * The steps are an array and not three booleans: the indicator at the top is then derived from the same
	 * state as the content, and neither can drift from the other.
	 */
	const STEPS = ['recipe', 'ingredients', 'steps'] as const;
	type Step = (typeof STEPS)[number];

	let creating = $state(false);
	let step = $state<Step>('recipe');
	let picker = $state<EmojiPicker | null>(null);

	/** `null` means the open form, if any, is creating a recipe. Set, it is rewriting the recipe of this id. */
	let editingId = $state<string | null>(null);

	let name = $state('');
	let emoji = $state(DEFAULT_EMOJI);
	let servings = $state(DEFAULT_SERVINGS);
	let lines = $state<RecipeLine[]>([{ name: '', qty: '', unit: DEFAULT_UNIT }]);
	let steps = $state<string[]>(['']);
	let stepIngredients = $state<number[][]>([[]]);
	let stepWidgets = $state<StepWidget[][]>([[]]);
	/** Each step's duration as typed (#310): two plain fields rather than a wheel picker. */
	let stepTimes = $state<{ hours: string; minutes: string }[]>([durationFields(null)]);
	const stepDurations = $derived(stepTimes.map((time) => durationFromFields(time.hours, time.minutes)));
	/** The ingredient rows a step can be linked to (#308): a row still unnamed has nothing to show. */
	const namedLines = $derived(
		lines.map((line, lineIndex) => ({ line, lineIndex })).filter(({ line }) => line.name.trim())
	);
	let notes = $state('');
	let tags = $state<string[]>([]);

	/** Set when the form is a copy of a recipe shared by another circle: saving creates a recipe of our own. */
	let copiedFrom = $state<string | null>(null);

	let formHeading = $state<HTMLHeadingElement | null>(null);

	/** The recipe whose generation dialog is open, and what is being asked of it. */
	let generatingFor = $state<string | null>(null);
	let guestCount = $state(DEFAULT_SERVINGS);
	let target = $state('');
	let generateDialog = $state<HTMLDialogElement | null>(null);
	$effect(() => {
		if (generatingFor) generateDialog?.showModal();
		else generateDialog?.close();
	});

	/** The recipe pending a delete confirmation. */
	let toDelete = $state<string | null>(null);
	let deleteDialog = $state<HTMLDialogElement | null>(null);
	$effect(() => {
		if (toDelete) deleteDialog?.showModal();
		else deleteDialog?.close();
	});

	/** The recipe sharing sheet, and which recipe it is currently open for. */
	let shareSheet = $state<RecipeShareSheet | null>(null);
	let sharingId = $state('');

	function share(recipeId: string) {
		sharingId = recipeId;
		shareSheet?.show();
	}

	/**
	 * The quick-actions sheet (#373): edit, add a photo, generate a list, delete. A recipe card in the wall
	 * shows only its photo and its name — the four actions that used to sit under an unfolded card now open
	 * this sheet instead, reached by a long press on the card or by its visible "more" button.
	 */
	let actionsSheet = $state<RecipeActionsSheet | null>(null);
	let actionsRecipe = $state<Recipe | null>(null);

	async function openActions(recipe: Recipe) {
		feedback.play('tap');
		actionsRecipe = recipe;
		// The sheet only mounts once `actionsRecipe` is set: `show()` needs the DOM update to have run first.
		await tick();
		actionsSheet?.show();
	}

	/**
	 * The search and the filters of the wall (#315, #316). Worked out on what is already in memory, never
	 * asked of the server: a kitchen or a shop is where the signal is worst.
	 */
	let query = $state('');
	let selection = $state(emptySelection());
	let filterSheet = $state<RecipeFilterSheet | null>(null);
	let barHeight = $state(0);

	/** Grouped once per change, not looked up per recipe per keystroke: a household has thousands of lines. */
	const linesByRecipe = $derived.by(() => {
		const names = new Map<string, string[]>();
		for (const line of data.recipeIngredients) {
			names.set(line.recipeId, [...(names.get(line.recipeId) ?? []), line.name]);
		}
		return names;
	});

	const durationsByRecipe = $derived.by(() => {
		const durations = new Map<string, (number | undefined)[]>();
		for (const step of data.recipeSteps) {
			durations.set(step.recipeId, [...(durations.get(step.recipeId) ?? []), step.durationSeconds]);
		}
		return durations;
	});

	const filterable = $derived(
		data.recipes.map((recipe) => ({
			id: recipe.id,
			name: recipe.name,
			tags: recipe.tags ?? [],
			tagLabels: knownTags(recipe.tags).map((tag) => t(`recipeTags.tag.${tag}`)),
			ingredients: linesByRecipe.get(recipe.id) ?? [],
			totalSeconds: totalSeconds(durationsByRecipe.get(recipe.id) ?? []),
			recipe
		}))
	);

	const shownRecipes = $derived(findRecipes(query, selection, filterable).map((entry) => entry.recipe));
	const narrowed = $derived(query.trim() !== '' || activeCount(selection) > 0);

	function showAll() {
		feedback.play('tap');
		query = '';
		selection = emptySelection();
	}

	/**
	 * Editing arrives as `?edit=<id>` — from the dedicated recipe page's Edit button, or from this page's own
	 * long-press sheet: the multi-step form lives only here, so both open it the same way.
	 */
	let editRequested: string | null = null;
	$effect(() => {
		const target = page.url.searchParams.get('edit');
		if (!target) {
			editRequested = null;
			return;
		}
		if (target === editRequested) return;

		const recipe = data.recipes.find((candidate) => candidate.id === target);
		if (!recipe) return;

		editRequested = target;
		untrack(() => {
			if (recipe.householdId === data.circle) edit(recipe);
			else editCopy(recipe);
		});
	});

	/** Whether the open form holds a draft read from elsewhere (a page, a photo, the AI), to be read over. */
	let fromImport = $state(false);

	/**
	 * The page's own photo, carried along the draft (#236). It has nowhere to live until the recipe itself
	 * is saved and gets an id — `recipe-photos` paths are keyed by recipe — so it is fetched and attached
	 * right after that save, the same review-then-save gesture already covering the rest of the draft.
	 */
	let importedImage = $state<string | null>(null);
	let imagePrompt = $state<string | undefined>(undefined);

	const rank = $derived(STEPS.indexOf(step));
	const isLast = $derived(rank === STEPS.length - 1);

	// "Create a recipe" hands its draft over here: the form must already be unfolded on arrival (#311).
	$effect(() => {
		const draft = recipeDraft.take();
		if (draft) openDraft(draft);
	});

	/**
	 * Puts a draft into the form, saving nothing — whatever it came from. What comes back from an unknown
	 * page or an AI answer is a draft: the person reads it, corrects it, then saves, as if they had typed the
	 * recipe themselves, but without having typed it.
	 */
	function openDraft(draft: RecipeDraft) {
		editingId = null;
		copiedFrom = null;
		name = draft.name;
		emoji = draft.emoji;
		servings = draft.servings;
		lines = draft.lines;
		steps = draft.steps;
		stepIngredients = draft.stepIngredients;
		stepWidgets = draft.stepDurations.map(() => []);
		stepTimes = draft.stepDurations.map((seconds) => durationFields(seconds));
		tags = [...draft.tags];
		notes = '';
		imagePrompt = draft.imagePrompt;
		importedImage = draft.image;
		fromImport = draft.reviewed;

		creating = true;
		step = 'recipe';
		void revealForm();
	}

	/**
	 * The form sits at the top of the page while the Edit button lives deep in the grid: without this, a tap
	 * on Edit filled a form far out of sight and the person saw nothing happen.
	 */
	async function revealForm() {
		await tick();
		formHeading?.scrollIntoView({ behavior: motionMs(1) ? 'smooth' : 'auto', block: 'start' });
		formHeading?.focus({ preventScroll: true });
	}

	async function revealCard(recipeId: string) {
		await tick();
		document
			.getElementById(`recipe-card-${recipeId}`)
			?.scrollIntoView({ behavior: motionMs(1) ? 'smooth' : 'auto', block: 'center' });
	}

	function reset() {
		creating = false;
		editingId = null;
		step = 'recipe';
		name = '';
		emoji = DEFAULT_EMOJI;
		servings = DEFAULT_SERVINGS;
		lines = [{ name: '', qty: '', unit: DEFAULT_UNIT }];
		steps = [''];
		stepIngredients = [[]];
		stepWidgets = [[]];
		stepTimes = [durationFields(null)];
		notes = '';
		tags = [];
		copiedFrom = null;
		fromImport = false;
		importedImage = null;
		imagePrompt = undefined;
	}

	/**
	 * Opens the same multi-step form the recipe was written in, prefilled from what is saved, and turns its
	 * next save into a rewrite instead of a new recipe. Ingredients and steps come from the same source the
	 * card already reads them from (`ingredientsOf`/`stepsOf`), in their saved order.
	 */
	function edit(recipe: Recipe) {
		fillFrom(recipe);
		editingId = recipe.id;
		void revealForm();
	}

	/** A recipe shared by another circle is theirs to change: we edit a copy that becomes our own. */
	function editCopy(recipe: Recipe) {
		fillFrom(recipe);
		editingId = null;
		copiedFrom = recipe.id;
		void revealForm();
	}

	function fillFrom(recipe: Recipe) {
		name = recipe.name;
		emoji = recipe.emoji;
		servings = recipe.servings;
		notes = recipe.notes ?? '';
		tags = [...(recipe.tags ?? [])];

		const existingLines = data
			.ingredientsOf(recipe.id)
			.map((line) => ({ name: line.name, qty: line.qty, unit: line.unit }));
		lines = existingLines.length ? existingLines : [{ name: '', qty: '', unit: DEFAULT_UNIT }];

		const savedSteps = data.stepsOf(recipe.id);
		const lineIds = data.ingredientsOf(recipe.id).map((line) => line.id);
		steps = savedSteps.length ? savedSteps.map((saved) => saved.body) : [''];
		stepTimes = savedSteps.length
			? savedSteps.map((saved) => durationFields(saved.durationSeconds))
			: [durationFields(null)];
		stepWidgets = savedSteps.length ? savedSteps.map((saved) => parseWidgets(saved.widgets)) : [[]];
		stepIngredients = savedSteps.length
			? savedSteps.map((saved) =>
					saved.ingredientIds.flatMap((id) => {
						const index = lineIds.indexOf(id);
						return index === -1 ? [] : [index];
					})
				)
			: [[]];

		creating = true;
		step = 'recipe';
		fromImport = false;
	}

	/**
	 * The form opens on a single row, and a button adds more, rather than an empty row appearing as soon as
	 * you fill the last one. A recipe has three ingredients as often as fifteen: a form that lengthens on
	 * its own while you type moves what you are reading, and announces nothing to a screen reader.
	 *
	 * The last row cannot be removed: an ingredient form with no field can no longer be filled, and it
	 * would take a second button to make one reappear.
	 */
	function addRow() {
		lines = [...lines, { name: '', qty: '', unit: DEFAULT_UNIT }];
	}

	function removeRow(index: number) {
		if (lines.length <= 1) return;
		lines = lines.filter((_, i) => i !== index);
		stepIngredients = withoutIngredient(stepIngredients, index);
	}

	function addStep() {
		steps = [...steps, ''];
		stepIngredients = [...stepIngredients, []];
		stepWidgets = [...stepWidgets, []];
		stepTimes = [...stepTimes, durationFields(null)];
	}

	function removeStep(index: number) {
		if (steps.length <= 1) return;
		steps = steps.filter((_, i) => i !== index);
		stepIngredients = stepIngredients.filter((_, i) => i !== index);
		stepWidgets = stepWidgets.filter((_, i) => i !== index);
		stepTimes = stepTimes.filter((_, i) => i !== index);
	}

	function toggleStepIngredient(stepIndex: number, lineIndex: number) {
		stepIngredients = toggleLink(stepIngredients, stepIndex, lineIndex);
	}

	function goBack() {
		if (rank > 0) step = STEPS[rank - 1];
	}

	/**
	 * The same button moves on a stage or saves, depending on where you are. A single `submit` for both:
	 * the Enter key then does what you expect of it at each step, which a "next" button outside the form
	 * would not give.
	 */
	function goNext(event: SubmitEvent) {
		event.preventDefault();

		if (!isLast) {
			step = STEPS[rank + 1];
			return;
		}

		if (!name.trim()) return;

		feedback.play('add');
		const editedId = editingId;
		if (editedId) {
			data.updateRecipe(editedId, {
				name,
				emoji,
				servings,
				notes,
				tags,
				ingredients: lines,
				steps,
				stepIngredients,
				stepDurations,
				stepWidgets
			});
		} else {
			const recipe = data.addRecipe({
				name,
				emoji,
				servings,
				notes,
				tags,
				ingredients: lines,
				steps,
				stepIngredients,
				imagePrompt,
				stepDurations,
				stepWidgets
			});
			attachImportedPhoto(recipe.id);
		}
		reset();
		if (editedId) void revealCard(editedId);
	}

	/**
	 * Fetches the page's own photo and attaches it, the same upload path a generated photo already uses
	 * (`ai.fetchRecipePhoto` → `data.setRecipePhoto`). Decorative only, like the generated photo: a failure
	 * here leaves the plain card standing, with nothing surfaced to the person.
	 */
	function attachImportedPhoto(recipeId: string) {
		const imageUrl = importedImage;
		if (!imageUrl) return;

		void ai.fetchRecipePhoto(data.circle, recipeId, imageUrl).then((outcome) => {
			if (outcome.ok) data.setRecipePhoto(recipeId, outcome.path);
		});
	}

	function remove(id: string) {
		feedback.play('remove');
		data.removeRecipe(id);
		toDelete = null;
		if (generatingFor === id) generatingFor = null;
	}

	function toggleGeneration(recipeId: string) {
		if (generatingFor === recipeId) {
			generatingFor = null;
			return;
		}

		generatingFor = recipeId;
		// We start from the recipe's own number of servings: most of the time you cook for that number, and the
		// field is then already right.
		guestCount = data.recipe(recipeId)?.servings ?? DEFAULT_SERVINGS;
		target = '';
	}

	async function generate(recipeId: string) {
		const issue = data.generateList(recipeId, guestCount, target || undefined);
		if (!issue) return;

		feedback.play('add');
		generatingFor = null;
		await goto(`/l/${issue.listId}`);
	}
</script>

<!--
	The household's recipes.

	A recipe is shared as soon as it is written: the household is a sharing circle, and everything entering
	it is read there. So there is no sharing gesture on this screen — its absence is the feature.

	What comes out of a recipe is a shopping list, not a link: the items created live their own life, you
	tick them and correct them in front of the aisle without the recipe moving.
-->
<svelte:head>
	<title>{t('recipes.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('recipes.title')}</h1>
<p class="text-muted-foreground text-label mt-1">{t('recipes.intro')}</p>

<!--
	The meal plan is a separate screen, not a mode of this one: picking several recipes for the week is a
	different gesture from writing one, and folding it in here would push what this page does first further
	down.
-->
<Button
	href="/meal-plan"
	variant="outline"
	data-test-id="recipes-meal-plan-link"
	class="fl-press mt-2 w-fit rounded-full"
>
	<CalendarDays size={18} aria-hidden="true" />
	{t('recipes.mealPlanLink')}
</Button>

{#if data.recipes.length > 0}
	<SearchFilterBar
		bind:query
		bind:height={barHeight}
		active={activeCount(selection)}
		onFilters={() => filterSheet?.show()}
		label={t('recipes.search.label')}
		placeholder={t('recipes.search.placeholder')}
		testPrefix="recipe"
	/>

	<!-- Spoken, not shown: the wall itself shows how many cards are left. -->
	<p class="sr-only" aria-live="polite" data-test-id="recipe-search-count">
		{narrowed ? t('recipes.search.count', { count: shownRecipes.length }) : ''}
	</p>
{/if}

{#if creating}
	<form onsubmit={goNext} class="bg-card mt-4 scroll-mt-4 space-y-5 rounded-xl border p-4" data-test-id="recipe-form">
		<h2
			bind:this={formHeading}
			tabindex="-1"
			class="text-h1 scroll-mt-4 font-semibold outline-none"
			data-test-id="recipe-form-title"
		>
			{editingId ? t('recipes.edit', { name }) : t('create.recipe')}
		</h2>

		{#if copiedFrom}
			<p class="text-label rounded-lg bg-[var(--fl-primary-tint)] p-3" data-test-id="recipe-copy-notice">
				{t('recipes.copyNotice')}
			</p>
		{/if}

		{#if fromImport}
			<!--
				What comes from a web page is a draft, and the screen must say so before the person saves. The
				quantities are split as best we can, the lines we could not read — "2 tablespoons of oil" — have come
				back whole in the name field, and none of it is written to the database until the form is submitted.
			-->
			<p
				class="text-label rounded-lg bg-[var(--fl-primary-tint)] p-3"
				data-test-id="recipe-import-review"
			>
				{t('recipes.import.review')}
			</p>
		{/if}

		<!--
			Where you are, said in full and not only by a coloured bar: "step 2 of 3" reads to a screen reader as
			much as to the eye, and a bar alone says neither how many are left nor what they contain.
		-->
		<ol class="flex flex-wrap gap-2" aria-label={t('recipes.stepper')}>
			{#each STEPS as id, index (id)}
				<li
					class="text-caption rounded-full border px-3 py-1 {step === id
						? 'bg-[var(--fl-primary-tint)] text-primary border-transparent font-semibold'
						: 'text-muted-foreground'}"
					aria-current={step === id ? 'step' : undefined}
				>
					{index + 1}. {t(`recipes.step.${id}`)}
				</li>
			{/each}
		</ol>

		{#if step === 'recipe'}
			<div class="space-y-4">
				<h3 class="text-h2 font-semibold">{t('recipes.step.recipe')}</h3>

				<div class="flex flex-wrap items-start gap-3">
					<div class="w-20">
						<Label for="recipe-emoji">{t('recipes.emoji')}</Label>
						<button
							type="button"
							id="recipe-emoji"
							onclick={() => picker?.show()}
							aria-haspopup="dialog"
							data-test-id="recipe-emoji"
							class="border-input bg-background fl-press grid min-h-[max(2.75rem,44px)] w-full place-items-center rounded-lg border text-2xl"
						>
							<span aria-hidden="true">{emoji}</span>
							<span class="sr-only">{t('emojiPicker.current', { emoji })}</span>
						</button>
					</div>

					{#if editingId}
						{@const editing = data.recipes.find((recipe) => recipe.id === editingId)}
						{#if editing}
							<div>
								<p class="text-label mb-2 font-medium">{t('recipes.photo')}</p>
								<RecipePhoto
									compact
									recipeId={editing.id}
									recipeName={name || editing.name}
									ingredientNames={lines.map((line) => line.name).filter(Boolean)}
									photoPath={editing.photoPath}
								/>
							</div>
						{/if}
					{/if}

					<div class="min-w-[12rem] flex-1">
						<Label for="recipe-name">{t('recipes.name')}</Label>
						<IconField icon={CookingPot}>
							<Input
								id="recipe-name"
								bind:value={name}
								data-test-id="recipe-name"
								required
								placeholder={t('recipes.namePlaceholder')}
							/>
						</IconField>
					</div>
				</div>

				<!--
					The number of servings is not decoration: it is the denominator of the scaling. "400 g of pasta" means
					nothing until you know how many people it is written for, and it is what makes it possible to
					generate for six a recipe written for four.
				-->
				<div>
					<Label for="recipe-servings">{t('recipes.servings')}</Label>
					<IconField icon={Users}>
						<Input
							id="recipe-servings"
							type="number"
							bind:value={servings}
							min={MIN_SERVINGS}
							max={MAX_SERVINGS}
							data-test-id="recipe-servings"
						/>
					</IconField>
					<p class="text-muted-foreground text-caption">{t('recipes.servingsHint')}</p>
				</div>

				<div>
					<Label for="recipe-notes">{t('recipes.notes')}</Label>
					<textarea
						id="recipe-notes"
						bind:value={notes}
						rows={3}
						data-test-id="recipe-notes"
						placeholder={t('recipes.notesPlaceholder')}
						class="border-input bg-background w-full rounded-md border p-2"
					></textarea>
				</div>

				<RecipeTagPicker bind:tags />
			</div>
		{:else if step === 'ingredients'}
			<div class="space-y-4">
				<h3 class="text-h2 font-semibold">{t('recipes.step.ingredients')}</h3>
				<p class="text-muted-foreground text-caption">{t('recipes.ingredientsHint')}</p>

				<ul class="space-y-3" data-test-id="recipe-ingredients">
					{#each lines as line, index (index)}
						<li class="grid gap-2 sm:grid-cols-[1fr_6rem_8rem_auto]">
							<div>
								<Label for="ingredient-name-{index}">
									{t('recipes.ingredientName', { rank: index + 1 })}
								</Label>
								<IconField icon={ShoppingBasket}>
									<Input
										id="ingredient-name-{index}"
										bind:value={line.name}
										data-test-class="ingredient-name"
										placeholder={t('recipes.ingredientPlaceholder')}
									/>
								</IconField>
							</div>

							<div>
								<Label for="ingredient-qty-{index}">{t('recipes.qty')}</Label>
								<Input
									id="ingredient-qty-{index}"
									bind:value={line.qty}
									inputmode="decimal"
									data-test-class="ingredient-qty"
								/>
							</div>

							<div>
								<Label for="ingredient-unit-{index}">{t('recipes.unit')}</Label>
								<select
									id="ingredient-unit-{index}"
									bind:value={line.unit}
									data-test-class="ingredient-unit"
									class="border-input bg-background min-h-[max(2.75rem,44px)] w-full rounded-md border"
								>
									{#each UNITS as id (id)}
										<option value={id}>{t(`units.${id}`)}</option>
									{/each}
								</select>
							</div>

							<div class="flex items-end">
								<Button
									type="button"
									variant="outline"
									onclick={() => removeRow(index)}
									disabled={lines.length === 1}
									aria-label={t('recipes.removeIngredient', { rank: index + 1 })}
									data-test-class="ingredient-remove"
									class="fl-press"
								>
									<Trash2 size={18} aria-hidden="true" />
								</Button>
							</div>
						</li>
					{/each}
				</ul>

				<Button
					type="button"
					variant="outline"
					onclick={addRow}
					data-test-id="recipe-add-ingredient"
					class="fl-press"
				>
					<Plus size={18} aria-hidden="true" />
					{t('recipes.addIngredient')}
				</Button>
			</div>
		{:else}
			<div class="space-y-4">
				<h3 class="text-h2 font-semibold">{t('recipes.step.steps')}</h3>
				<p class="text-muted-foreground text-caption">{t('recipes.stepsHint')}</p>

				<ol class="space-y-3" data-test-id="recipe-steps">
					{#each steps as _, index (index)}
						<li class="space-y-2">
							<div class="flex items-end gap-2">
								<div class="min-w-0 flex-1">
									<Label for="recipe-step-{index}">{t('recipes.stepBody', { rank: index + 1 })}</Label>
									<textarea
										id="recipe-step-{index}"
										bind:value={steps[index]}
										rows={2}
										data-test-class="recipe-step"
										class="border-input bg-background w-full rounded-md border p-2"
									></textarea>
								</div>
								<Button
									type="button"
									variant="outline"
									onclick={() => removeStep(index)}
									disabled={steps.length === 1}
									aria-label={t('recipes.removeStep', { rank: index + 1 })}
									data-test-class="recipe-step-remove"
									class="fl-press"
								>
									<Trash2 size={18} aria-hidden="true" />
								</Button>
							</div>

							<fieldset class="min-w-0" data-test-class="recipe-step-duration">
								<legend class="text-label font-semibold">
									{t('recipes.stepDuration', { rank: index + 1 })}
								</legend>
								<div class="mt-1 flex flex-wrap gap-3">
									<div class="w-32">
										<Label for="recipe-step-{index}-hours">{t('recipes.durationHours')}</Label>
										<Input
											id="recipe-step-{index}-hours"
											bind:value={stepTimes[index].hours}
											inputmode="numeric"
											pattern="[0-9]*"
											maxlength={2}
											autocomplete="off"
											data-test-class="recipe-step-hours"
											class="text-product min-h-12 h-auto"
										/>
									</div>
									<div class="w-32">
										<Label for="recipe-step-{index}-minutes">{t('recipes.durationMinutes')}</Label>
										<Input
											id="recipe-step-{index}-minutes"
											bind:value={stepTimes[index].minutes}
											inputmode="numeric"
											pattern="[0-9]*"
											maxlength={3}
											autocomplete="off"
											data-test-class="recipe-step-minutes"
											class="text-product min-h-12 h-auto"
										/>
									</div>
								</div>
							</fieldset>

							<StepWidgetsEditor
								bind:widgets={stepWidgets[index]}
								rank={index + 1}
								onQuickTimer={minutes => (stepTimes[index] = durationFields(minutes * 60))}
							/>

							{#if namedLines.length}
								<fieldset class="min-w-0 sm:rounded-lg sm:border sm:p-3" data-test-class="recipe-step-ingredients">
									<legend class="text-label mb-2 font-semibold sm:px-1">
										{t('recipes.stepIngredients', { rank: index + 1 })}
									</legend>
									<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
										{#each namedLines as { line, lineIndex } (lineIndex)}
											{@const checked = stepIngredients[index]?.includes(lineIndex) ?? false}
											<label
												class="fl-press has-[:focus-visible]:ring-ring has-[:checked]:border-primary has-[:checked]:bg-primary/10 flex min-h-[max(3rem,48px)] cursor-pointer items-center gap-2 rounded-lg border px-2 py-1 has-[:focus-visible]:ring-2"
											>
												<input
													type="checkbox"
													{checked}
													onchange={() => toggleStepIngredient(index, lineIndex)}
													data-test-class="recipe-step-ingredient"
													class="accent-primary size-6 shrink-0"
												/>
												<span class="text-label min-w-0 hyphens-auto [overflow-wrap:anywhere]">{line.name}</span>
											</label>
										{/each}
									</div>
								</fieldset>
							{/if}
						</li>
					{/each}
				</ol>

				<Button
					type="button"
					variant="outline"
					onclick={addStep}
					data-test-id="recipe-add-step"
					class="fl-press"
				>
					<Plus size={18} aria-hidden="true" />
					{t('recipes.addStep')}
				</Button>
			</div>
		{/if}

		<div class="flex flex-wrap items-stretch gap-2">
			{#if rank > 0}
				<Button
					type="button"
					variant="outline"
					onclick={goBack}
					data-test-id="recipe-back"
					class="fl-press"
				>
					<ChevronLeft size={18} aria-hidden="true" />
					{t('recipes.back')}
				</Button>
			{/if}

			<Button type="submit" data-test-id="recipe-next" class="fl-press">
				{#if isLast}
					<Check size={18} aria-hidden="true" />
					{t('common.save')}
				{:else}
					{t('recipes.next')}
					<ChevronRight size={18} aria-hidden="true" />
				{/if}
			</Button>

			<Button
				type="button"
				variant="outline"
				onclick={reset}
				data-test-id="recipe-cancel"
				class="fl-press"
			>
				{t('common.cancel')}
			</Button>
		</div>
	</form>
{/if}

{#if data.recipes.length === 0}
	<EmptyState illustration="cart" text={t('recipes.empty')} testId="recipes-empty">
		{#snippet action()}
			{#if !creating}
				<Button href="/recipes/new" data-test-id="recipes-empty-create" class="fl-press">
					<Plus size={18} aria-hidden="true" />
					{t('recipes.create.title')}
				</Button>
			{/if}
		{/snippet}
	</EmptyState>
{:else if shownRecipes.length === 0}
	<EmptyState illustration="inbox" text={t('recipes.search.empty')} testId="recipes-search-empty">
		{#snippet action()}
			<Button variant="outline" onclick={showAll} data-test-id="recipes-search-reset" class="fl-press">
				{t('recipes.search.reset')}
			</Button>
		{/snippet}
	</EmptyState>
{:else}
	<!--
		A Pinterest-style wall, not a stack: a recipe is a photo before it is a document, and a single column
		of fully unfolded cards buried that photo under ingredients nobody was reading yet. `columns` packs
		cards of uneven height into that wall in plain CSS — `break-inside-avoid` on each card is what keeps
		one from being split across two columns, no masonry library needed. Column count follows this app's
		own `phone`/`full` breakpoints rather than an invented one: two on a phone or a portrait tablet, four
		once there is a real desktop-width landscape screen to fill.
	-->
	<ul class="fl-recipe-grid mt-6 columns-2 gap-3.5 full:columns-4">
		{#each shownRecipes as recipe (recipe.id)}
			{@const owned = recipe.householdId === data.circle}
			<li id="recipe-card-{recipe.id}" class="mb-3.5 scroll-mt-4 break-inside-avoid">
				<Card.Root data-test-class="recipe-card" class="fl-home-card relative overflow-hidden p-0">
					<!--
						A card is only its photo (or its emoji, when there is none) and its name: a tap opens the
						recipe's own page (#373), the dense Pinterest wall has no room to also show everything a
						recipe holds. `use:longpress` opens the quick-actions sheet without leaving the wall; the
						visible "more" button does the same for a keyboard or a screen reader, since a gesture
						nobody can see is a gesture only some people can use — seniors first.
					-->
					<a
						href="/recipes/{recipe.id}"
						use:longpress={() => openActions(recipe)}
						aria-label={t('recipes.openAria', { name: recipe.name })}
						data-test-class="recipe-card-header"
						class="fl-press block w-full text-left"
					>
						<RecipeCover recipeName={recipe.name} emoji={recipe.emoji} photoPath={recipe.photoPath} />
						<span class="flex flex-wrap items-start gap-2 p-3 pe-14">
							<!-- text-body, not text-product, and its own row (#441): at two columns on a phone, sharing
							the row with the servings badge left the title too little width, wrapping almost one
							word per line. -->
						<Card.Title class="text-body min-w-0 basis-full break-words">{recipe.name}</Card.Title>
							<span
								class="bg-primary text-primary-foreground text-caption mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
								aria-label={t('recipes.servingsCount', { count: recipe.servings })}
							>
								<UtensilsCrossed size={12} aria-hidden="true" />
								<span aria-hidden="true">{recipe.servings}</span>
							</span>
							{#if !owned}
								<span
									class="bg-muted text-muted-foreground text-caption mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold"
									data-test-class="recipe-shared-badge"
								>
									{t('recipes.sharedFrom', { circle: data.circleName(recipe.householdId) })}
								</span>
							{/if}
						</span>
					</a>

					<button
						type="button"
						onclick={() => openActions(recipe)}
						aria-label={t('recipes.actionsAria', { name: recipe.name })}
						aria-haspopup="dialog"
						data-test-class="recipe-card-actions"
						class="fl-press bg-background/90 text-foreground absolute end-2 top-2 grid min-h-[max(2.75rem,48px)] min-w-[max(2.75rem,48px)] place-items-center rounded-full border shadow-sm"
					>
						<MoreVertical size={20} aria-hidden="true" />
					</button>

					<!-- Outside the link: a list has no place inside an anchor, and the tags read at rest. -->
					<RecipeTagChips tags={recipe.tags} class="px-3 pb-3" />
				</Card.Root>
			</li>
		{/each}
	</ul>
{/if}

<!--
	On a phone the bar floats over the end of the wall: this keeps the last card clear of it. Its own
	height alone is not enough — `.fl-above-nav` also lifts it `inset-block-end: calc(var(--fl-navbar-h) +
	0.75rem)` above the viewport bottom, so the spacer has to cover that gap too.
-->
<div
	class="md:hidden"
	style="height: calc({barHeight}px + var(--fl-navbar-h, 4rem) + 0.75rem)"
	aria-hidden="true"
></div>

<RecipeFilterSheet bind:this={filterSheet} bind:selection recipes={filterable} {query} />

<EmojiPicker bind:this={picker} value={emoji} onpick={(chosen) => (emoji = chosen)} />

<RecipeShareSheet bind:this={shareSheet} recipeId={sharingId} />

{#if actionsRecipe}
	{@const actionsOwned = actionsRecipe.householdId === data.circle}
	<RecipeActionsSheet
		bind:this={actionsSheet}
		recipeName={actionsRecipe.name}
		owned={actionsOwned}
		onEdit={() => goto(`/recipes?edit=${actionsRecipe!.id}`)}
		onPhoto={() => goto(`/recipes?edit=${actionsRecipe!.id}`)}
		onGenerate={() => toggleGeneration(actionsRecipe!.id)}
		onDelete={() => (toDelete = actionsRecipe!.id)}
	/>
{/if}

<!--
	Generating a list, and confirming a delete: both used to sit under the card they are about, but a card no
	longer unfolds (#373). A dialog keeps the same one-recipe-at-a-time shape without needing a whole panel
	under every tile in the wall.
-->
<dialog
	bind:this={generateDialog}
	onclick={(event) => {
		if (event.target === generateDialog) generatingFor = null;
	}}
	onclose={() => (generatingFor = null)}
	class="fl-sheet"
	aria-labelledby="recipe-generate-title"
>
	{#if generatingFor}
		{@const generatingRecipe = data.recipe(generatingFor)}
		{#if generatingRecipe}
			<div
				class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl"
				class:fl-rise={settings.animates}
				data-test-class="recipe-generate-form"
			>
				<h2 id="recipe-generate-title" class="text-h2 font-semibold break-words">{t('recipes.generate')}</h2>
				<p class="text-muted-foreground text-label mt-1">{generatingRecipe.name}</p>

				<div class="mt-4 space-y-3">
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
							{t('recipes.peopleHint', { servings: generatingRecipe.servings })}
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
						<Button onclick={() => generate(generatingFor!)} data-test-class="generate-submit" class="fl-press">
							<ShoppingBasket size={18} aria-hidden="true" />
							{t('recipes.generateSubmit')}
						</Button>
						<Button variant="outline" onclick={() => (generatingFor = null)} class="fl-press">
							{t('common.cancel')}
						</Button>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</dialog>

<dialog
	bind:this={deleteDialog}
	onclick={(event) => {
		if (event.target === deleteDialog) toDelete = null;
	}}
	onclose={() => (toDelete = null)}
	class="fl-sheet"
	aria-labelledby="recipe-delete-title"
>
	{#if toDelete}
		{@const deletingRecipe = data.recipe(toDelete)}
		{#if deletingRecipe}
			<div class="bg-card relative space-y-3 rounded-t-2xl border p-4 md:rounded-2xl" class:fl-rise={settings.animates}>
				<p id="recipe-delete-title" class="text-label">
					{t('recipes.deleteConfirm', { name: deletingRecipe.name })}
				</p>
				<div class="flex flex-wrap gap-2">
					<Button
						variant="destructive"
						onclick={() => remove(deletingRecipe.id)}
						data-test-class="recipe-delete-confirm"
						class="fl-press"
					>
						{t('recipes.deleteYes')}
					</Button>
					<Button variant="outline" onclick={() => (toDelete = null)} class="fl-press">
						{t('common.cancel')}
					</Button>
				</div>
			</div>
		{/if}
	{/if}
</dialog>
