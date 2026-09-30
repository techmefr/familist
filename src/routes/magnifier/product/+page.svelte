<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { i18n, t } from '$i18n/index.svelte';
	import { DEFAULT_UNIT } from '$domain/units';
	import { lookupProduct, OFF_ATTRIBUTION_URL, type Lookup, type Product } from '$domain/openfoodfacts';
	import { productWarnings, type Eater } from '$domain/person-profile';
	import type { ScanResult } from '$scan/scanner';
	import MagnifierModes from '$components/app/MagnifierModes.svelte';
	import ScanButton from '$components/app/ScanButton.svelte';
	import * as Card from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Check, Info, ShieldAlert, TriangleAlert } from '@lucide/svelte';

	let ean = $state('');
	let result = $state<Lookup | null>(null);
	let isLoading = $state(false);
	let targetList = $state('');
	let addedTo = $state<string | null>(null);

	const product = $derived(result?.status === 'found' ? result.product : null);

	const eaters = $derived<Eater[]>(
		data.householdPersons.map(person => ({
			personId: person.id,
			name: person.name,
			profile: data.profileOf(person.id) ?? null
		}))
	);
	const warnings = $derived(product ? productWarnings(product.allergens, eaters) : []);

	async function search(code: string) {
		const trimmed = code.trim();
		if (!trimmed) return;

		isLoading = true;
		addedTo = null;
		result = await lookupProduct(trimmed, i18n.locale);
		isLoading = false;
		if (result.status === 'found') feedback.play('add');
	}

	function scanned(scan: ScanResult) {
		ean = scan.value;
		void search(scan.value);
	}

	function label(item: Product): string {
		return item.brand ? `${item.name} — ${item.brand}` : item.name;
	}

	function addToList(item: Product) {
		const listId = targetList || data.lists.at(-1)?.id;
		if (!listId) return;

		data.addItem(listId, { name: item.name, qty: '1', unit: DEFAULT_UNIT });
		feedback.play('add');
		addedTo = data.lists.find(list => list.id === listId)?.name ?? null;
	}
</script>

<svelte:head>
	<title>{t('product.title')} — {t('app.name')}</title>
</svelte:head>

<MagnifierModes active="product" />

<h1 class="text-h1 mt-4 font-semibold">{t('product.title')}</h1>
<p class="text-muted-foreground text-label mt-1">{t('product.intro')}</p>

<div class="mt-4 space-y-3">
	<ScanButton onScanned={scanned} />

	<form
		onsubmit={event => {
			event.preventDefault();
			void search(ean);
		}}
		class="flex items-end gap-2"
	>
		<div class="min-w-0 flex-1">
			<Label for="product-ean">{t('product.manual')}</Label>
			<Input
				id="product-ean"
				bind:value={ean}
				inputmode="numeric"
				autocomplete="off"
				maxlength={14}
				data-test-id="product-ean"
			/>
		</div>
		<Button type="submit" disabled={isLoading} data-test-id="product-search">{t('product.search')}</Button>
	</form>
</div>

<div aria-live="polite" class="mt-4" data-test-id="product-result">
	{#if isLoading}
		<p class="text-muted-foreground text-label">{t('product.loading')}</p>
	{:else if result && result.status !== 'found'}
		<p class="text-label" role="status" data-test-id="product-{result.status}">
			{t(`product.${result.status}`)}
		</p>
	{:else if product}
		<Card.Root>
			<Card.Content class="space-y-3">
				<div class="flex gap-3">
					{#if product.imageUrl}
						<img src={product.imageUrl} alt="" class="size-20 shrink-0 rounded-lg object-contain" />
					{/if}
					<div class="min-w-0">
						<h2 class="text-h2 font-semibold break-words" data-test-id="product-name">{label(product)}</h2>
						{#if product.quantity}<p class="text-muted-foreground text-label">{product.quantity}</p>{/if}
						<p class="text-muted-foreground text-caption">
							{#if product.isVegan}{t('people.diet.vegan')}{:else if product.isVegetarian}{t('people.diet.vegetarian')}{/if}
						</p>
					</div>
				</div>

				{#if warnings.length > 0}
					<ul class="space-y-1" data-test-id="product-warnings">
						{#each warnings as warning, index (index)}
							<li class="text-label flex items-start gap-2">
								{#if warning.severity === 'severe' || warning.kind === 'diet'}
									<ShieldAlert size={18} class="text-destructive mt-0.5 shrink-0" aria-hidden="true" />
								{:else}
									<TriangleAlert size={18} class="mt-0.5 shrink-0 text-[var(--fl-warning)]" aria-hidden="true" />
								{/if}
								<span>
									{t('people.warn', {
										what: warning.kind === 'diet' ? t(`people.diet.${warning.what}`) : warning.what,
										name: warning.name
									})}
								</span>
							</li>
						{/each}
					</ul>
				{/if}

				<div>
					<h3 class="text-label font-semibold">{t('product.allergens')}</h3>
					{#if product.allergens.length + product.otherAllergens.length === 0}
						<p class="text-muted-foreground text-label">{t('product.noAllergens')}</p>
					{:else}
						<ul class="mt-1 flex flex-wrap gap-2">
							{#each product.allergens as id (id)}
								<li class="text-caption rounded-full border px-2 py-0.5 font-medium">{t(`people.allergen.${id}`)}</li>
							{/each}
							{#each product.otherAllergens as other (other)}
								<li class="text-caption rounded-full border px-2 py-0.5 font-medium">{other}</li>
							{/each}
						</ul>
					{/if}
					{#if product.traces.length > 0}
						<p class="text-muted-foreground text-caption mt-2">
							{t('product.traces')}: {product.traces.map(id => t(`people.allergen.${id}`)).join(', ')}
						</p>
					{/if}
				</div>

				{#if product.ingredients}
					<div>
						<h3 class="text-label font-semibold">{t('product.ingredients')}</h3>
						<p class="text-label break-words">{product.ingredients}</p>
					</div>
				{/if}

				{#if data.lists.length > 0}
					<div class="flex flex-wrap items-end gap-2">
						<div>
							<Label for="product-list">{t('product.addTo')}</Label>
							<select
								id="product-list"
								bind:value={targetList}
								class="border-input bg-background min-h-[max(2.75rem,44px)] rounded-md border px-2"
							>
								{#each data.lists as list (list.id)}
									<option value={list.id} selected={list.id === data.lists.at(-1)?.id}>{list.emoji} {list.name}</option>
								{/each}
							</select>
						</div>
						<Button onclick={() => addToList(product)} data-test-id="product-add">{t('product.add')}</Button>
					</div>
					{#if addedTo}
						<p class="text-primary text-label flex items-center gap-2" role="status" data-test-id="product-added">
							<Check size={16} aria-hidden="true" />
							{t('product.added', { list: addedTo })}
						</p>
					{/if}
				{/if}
			</Card.Content>
		</Card.Root>

		<p class="text-muted-foreground text-caption mt-3 flex items-start gap-2">
			<Info size={14} class="mt-0.5 shrink-0" aria-hidden="true" />
			<span>
				{t('product.attribution')}
				<a href={OFF_ATTRIBUTION_URL} class="underline" rel="noopener noreferrer" target="_blank">Open Food Facts</a>
			</span>
		</p>
	{/if}
</div>
