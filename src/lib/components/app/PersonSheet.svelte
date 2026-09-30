<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { t } from '$i18n/index.svelte';
	import type { AllergySeverity, HouseholdPerson, PersonAllergy } from '$db/schema';
	import { DIETS, STANDARD_ALLERGENS } from '$domain/allergens';
	import { MAX_TAG_LENGTH, SEVERITIES, clampPortion } from '$domain/person-profile';
	import { slugify } from '$domain/slug';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Lock, X } from '@lucide/svelte';

	let { person }: { person: HouseholdPerson | null } = $props();

	const PORTIONS = [
		{ value: 0.5, key: 'child' },
		{ value: 0.75, key: 'small' },
		{ value: 1, key: 'normal' },
		{ value: 1.5, key: 'big' }
	] as const;
	const THIS_YEAR = new Date().getFullYear();

	let dialog = $state<HTMLDialogElement | null>(null);
	let allergies = $state<PersonAllergy[]>([]);
	let diets = $state<string[]>([]);
	let likes = $state<string[]>([]);
	let dislikes = $state<string[]>([]);
	let birthYear = $state('');
	let portion = $state(1);
	let isGuest = $state(false);
	let notes = $state('');
	let isShared = $state(false);
	let customAllergy = $state('');
	let likeDraft = $state('');
	let dislikeDraft = $state('');

	export function show() {
		const profile = person ? data.profileOf(person.id) : undefined;
		allergies = profile ? [...profile.allergies] : [];
		diets = profile ? [...profile.diets] : [];
		likes = profile ? [...profile.likes] : [];
		dislikes = profile ? [...profile.dislikes] : [];
		birthYear = profile?.birthYear ? String(profile.birthYear) : '';
		portion = profile?.portionFactor ?? 1;
		isGuest = profile?.guest ?? !person?.linkedUserId;
		notes = profile?.notes ?? '';
		isShared = profile?.shareWarnings ?? false;
		dialog?.showModal();
	}

	const labelOf = (allergy: PersonAllergy) =>
		STANDARD_ALLERGENS.some(id => id === allergy.id) ? t(`people.allergen.${allergy.id}`) : allergy.label;

	function toggleAllergen(id: string) {
		allergies = allergies.some(a => a.id === id)
			? allergies.filter(a => a.id !== id)
			: [...allergies, { id, label: t(`people.allergen.${id}`), severity: 'intolerance' }];
	}

	function addCustom() {
		const label = customAllergy.trim();
		if (!label) return;
		const id = slugify(label);
		if (id && !allergies.some(a => a.id === id)) allergies = [...allergies, { id, label, severity: 'intolerance' }];
		customAllergy = '';
	}

	function setSeverity(id: string, severity: AllergySeverity) {
		allergies = allergies.map(a => (a.id === id ? { ...a, severity } : a));
	}

	function toggleDiet(diet: string) {
		diets = diets.includes(diet) ? diets.filter(d => d !== diet) : [...diets, diet];
	}

	function addTag(kind: 'likes' | 'dislikes') {
		const draft = (kind === 'likes' ? likeDraft : dislikeDraft).trim().slice(0, MAX_TAG_LENGTH);
		if (!draft) return;
		if (kind === 'likes') {
			likes = likes.includes(draft) ? likes : [...likes, draft];
			likeDraft = '';
		} else {
			dislikes = dislikes.includes(draft) ? dislikes : [...dislikes, draft];
			dislikeDraft = '';
		}
	}

	function save(event: SubmitEvent) {
		event.preventDefault();
		if (!person) return;

		const year = Number(birthYear);
		data.saveProfile(person.id, {
			allergies,
			diets,
			likes,
			dislikes,
			birthYear: Number.isInteger(year) && year >= 1900 && year <= THIS_YEAR ? year : undefined,
			portionFactor: clampPortion(portion),
			guest: isGuest,
			notes,
			shareWarnings: isShared
		});
		dialog?.close();
	}
</script>

<dialog
	bind:this={dialog}
	onclick={event => {
		if (event.target === dialog) dialog?.close();
	}}
	aria-labelledby="person-sheet-title"
	data-test-id="person-sheet"
	class="m-auto max-h-[90dvh] w-[min(40rem,calc(100%-1rem))] max-w-full overflow-y-auto rounded-2xl border bg-transparent p-0 backdrop:bg-[var(--fl-scrim)]"
>
	{#if person}
		<form onsubmit={save} class="bg-card space-y-5 rounded-2xl p-4">
			<div class="flex items-start justify-between gap-2">
				<h2 id="person-sheet-title" class="text-h2 font-semibold">{person.name}</h2>
				<button
					type="button"
					onclick={() => dialog?.close()}
					aria-label={t('common.close')}
					class="fl-press text-muted-foreground grid size-11 place-items-center rounded-full"
				>
					<X size={20} aria-hidden="true" />
				</button>
			</div>

			<p
				class="bg-[var(--fl-primary-tint)] text-label flex items-center gap-2 rounded-lg p-3 font-medium"
				data-test-id="person-private"
			>
				<Lock size={16} aria-hidden="true" />
				{t('people.private')}
			</p>

			<fieldset>
				<legend class="text-label mb-2 font-semibold">{t('people.allergies')}</legend>
				<div class="flex flex-wrap gap-2">
					{#each STANDARD_ALLERGENS as id (id)}
						<label class="fl-choice">
							<input
								type="checkbox"
								class="sr-only"
								checked={allergies.some(a => a.id === id)}
								onchange={() => toggleAllergen(id)}
								data-test-id="person-allergen-{id}"
							/>
							{t(`people.allergen.${id}`)}
						</label>
					{/each}
				</div>

				<div class="mt-3 flex gap-2">
					<Input
						bind:value={customAllergy}
						maxlength={60}
						aria-label={t('people.customAllergy')}
						placeholder={t('people.customAllergy')}
						data-test-id="person-allergy-custom"
						onkeydown={event => {
							if (event.key === 'Enter') {
								event.preventDefault();
								addCustom();
							}
						}}
					/>
					<Button type="button" variant="outline" onclick={addCustom}>{t('people.add')}</Button>
				</div>

				{#if allergies.length > 0}
					<ul class="mt-3 space-y-2">
						{#each allergies as allergy (allergy.id)}
							<li class="flex flex-wrap items-center gap-2" data-test-class="person-allergy">
								<span class="min-w-0 flex-1 basis-[8rem] font-medium">{labelOf(allergy)}</span>
								<select
									value={allergy.severity}
									onchange={event => setSeverity(allergy.id, event.currentTarget.value as AllergySeverity)}
									aria-label={t('people.severityFor', { name: labelOf(allergy) })}
									class="border-input bg-background min-h-[max(2.75rem,44px)] rounded-md border px-2"
								>
									{#each SEVERITIES as severity (severity)}
										<option value={severity}>{t(`people.severity.${severity}`)}</option>
									{/each}
								</select>
								<button
									type="button"
									onclick={() => (allergies = allergies.filter(a => a.id !== allergy.id))}
									aria-label={t('people.removeItem', { name: labelOf(allergy) })}
									class="fl-press text-muted-foreground grid size-11 place-items-center rounded-full"
								>
									<X size={18} aria-hidden="true" />
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</fieldset>

			<fieldset>
				<legend class="text-label mb-2 font-semibold">{t('people.diets')}</legend>
				<div class="flex flex-wrap gap-2">
					{#each DIETS as diet (diet)}
						<label class="fl-choice">
							<input
								type="checkbox"
								class="sr-only"
								checked={diets.includes(diet)}
								onchange={() => toggleDiet(diet)}
								data-test-id="person-diet-{diet}"
							/>
							{t(`people.diet.${diet}`)}
						</label>
					{/each}
				</div>
			</fieldset>

			{#each [{ kind: 'likes', list: likes, label: 'people.likes' }, { kind: 'dislikes', list: dislikes, label: 'people.dislikes' }] as tags (tags.kind)}
				<fieldset>
					<legend class="text-label mb-2 font-semibold">{t(tags.label)}</legend>
					<div class="flex flex-wrap gap-2">
						{#each tags.list as tag (tag)}
							<span class="bg-muted inline-flex items-center gap-1 rounded-full ps-3 text-label">
								{tag}
								<button
									type="button"
									onclick={() => {
										if (tags.kind === 'likes') likes = likes.filter(l => l !== tag);
										else dislikes = dislikes.filter(l => l !== tag);
									}}
									aria-label={t('people.removeItem', { name: tag })}
									class="fl-press grid size-11 place-items-center rounded-full"
								>
									<X size={14} aria-hidden="true" />
								</button>
							</span>
						{/each}
					</div>
					<div class="mt-2 flex gap-2">
						<Input
							value={tags.kind === 'likes' ? likeDraft : dislikeDraft}
							oninput={event => {
								if (tags.kind === 'likes') likeDraft = event.currentTarget.value;
								else dislikeDraft = event.currentTarget.value;
							}}
							maxlength={MAX_TAG_LENGTH}
							aria-label={t(tags.label)}
							onkeydown={event => {
								if (event.key === 'Enter') {
									event.preventDefault();
									addTag(tags.kind as 'likes' | 'dislikes');
								}
							}}
						/>
						<Button type="button" variant="outline" onclick={() => addTag(tags.kind as 'likes' | 'dislikes')}>
							{t('people.add')}
						</Button>
					</div>
				</fieldset>
			{/each}

			<fieldset>
				<legend class="text-label mb-2 font-semibold">{t('people.portion')}</legend>
				<div class="flex flex-wrap gap-2">
					{#each PORTIONS as option (option.value)}
						<label class="fl-choice">
							<input
								type="radio"
								name="person-portion"
								class="sr-only"
								checked={portion === option.value}
								onchange={() => (portion = option.value)}
								data-test-id="person-portion-{option.value}"
							/>
							{t(`people.portions.${option.key}`)} ×{option.value}
						</label>
					{/each}
				</div>
				<div class="mt-3 max-w-40">
					<Label for="person-birth-year">{t('people.birthYear')}</Label>
					<Input id="person-birth-year" bind:value={birthYear} inputmode="numeric" maxlength={4} />
				</div>
			</fieldset>

			<label class="flex min-h-11 items-center gap-3">
				<input type="checkbox" bind:checked={isGuest} class="size-5" />
				<span class="text-label">{t('people.guest')}</span>
			</label>

			<div>
				<Label for="person-notes">{t('people.notes')}</Label>
				<textarea
					id="person-notes"
					bind:value={notes}
					rows="3"
					maxlength="2000"
					class="border-input bg-background mt-1 w-full rounded-md border p-2"
				></textarea>
			</div>

			<label class="flex items-start gap-3">
				<input type="checkbox" bind:checked={isShared} class="mt-1 size-5" data-test-id="person-share-warnings" />
				<span class="text-label">
					{t('people.shareWarnings')}
					<span class="text-muted-foreground text-caption block">{t('people.shareWarningsHint')}</span>
				</span>
			</label>

			<div class="flex gap-2">
				<Button type="submit" data-test-id="person-save">{t('common.save')}</Button>
				<Button type="button" variant="outline" onclick={() => dialog?.close()}>{t('common.cancel')}</Button>
			</div>
		</form>
	{/if}
</dialog>
