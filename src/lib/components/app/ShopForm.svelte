<script lang="ts">
	import { untrack } from 'svelte';
	import { data } from '$stores/data.svelte';
	import { sync } from '$sync/index.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { t } from '$i18n/index.svelte';
	import { TINTS } from '$domain/tint';
	import { BRANDS, findBrand } from '$domain/brand-catalogue';
	import { searchShops, type ShopLookupResult } from '$domain/shop-lookup';
	import { placeCredentials } from '$stores/place-credentials.svelte';
	import type { Shop } from '$db/schema';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import IconField from '$components/app/IconField.svelte';
	import { Plus, Store, Building2, MapPin, RefreshCw, Check, Search } from '@lucide/svelte';

	/**
	 * The shop creation form, where it is needed.
	 *
	 * It lives on the shops screen, but also in a sheet opened from elsewhere: saving a loyalty card is
	 * often when you discover you have not created the matching shop yet. Making the person leave the card
	 * form to go and create it elsewhere loses what they had started typing.
	 *
	 * The field ids are prefixed: two copies of the form can coexist on the same page, and two identical
	 * `for` attributes would make both labels point at the same place.
	 */
	/**
	 * With `shop`, the same form edits instead of creating: the fields are those of creation, the rules on
	 * the three-letter code too, and a second edit form would only have repeated them identically — while
	 * letting the two drift apart over time.
	 */
	let {
		prefix = 'shop',
		shop: editing,
		oncreated,
		onsaved,
		oncancel
	}: {
		prefix?: string;
		shop?: Shop;
		oncreated?: (shop: Shop) => void;
		onsaved?: () => void;
		oncancel?: () => void;
	} = $props();

	// The fields start from the shop as it is on opening, and belong to the form afterwards: the form is
	// remounted on every edit, and an update coming from the sync must not overwrite a typing in progress.
	let brand = $state(untrack(() => editing?.brand ?? ''));
	let name = $state(untrack(() => editing?.name ?? ''));
	let address = $state(untrack(() => editing?.address ?? ''));
	let short = $state(untrack(() => editing?.short ?? ''));
	let lat = $state(untrack(() => editing?.lat));
	let lng = $state(untrack(() => editing?.lng));

	let captured = $state(false);
	let gpsError = $state('');

	/**
	 * Search and manual entry as two modes, not two blocks stacked on the same screen: reading a form meant
	 * for typing while a search box and its hint sit above it made the whole thing look like an extra step,
	 * when a shop typed by hand needs none of it. Editing an existing shop has no search to offer at all.
	 */
	let mode = $state<'search' | 'manual'>('manual');

	let lookupQuery = $state('');
	let lookupResults = $state<ShopLookupResult[]>([]);
	let lookupBusy = $state(false);
	let lookupError = $state(false);
	let lookupSearched = $state(false);

	/**
	 * Filling the form from a name instead of typing brand, name and address one by one. Unlike everything
	 * else here, this sends the query to Nominatim — see `shop-lookup.ts` for why, and `lookupHint` below for
	 * what tells the person so.
	 */
	async function runLookup() {
		const query = lookupQuery.trim();
		if (!query || lookupBusy) return;

		lookupBusy = true;
		lookupError = false;

		try {
			lookupResults = await searchShops(query, placeCredentials.key('google_places'));
		} catch {
			lookupResults = [];
			lookupError = true;
		} finally {
			lookupBusy = false;
			lookupSearched = true;
		}
	}

	function pickLookupResult(result: ShopLookupResult) {
		name = result.name;
		address = result.address;
		lat = result.lat;
		lng = result.lng;

		const match = findBrand(result.name);
		if (match) {
			brand = match.name;
			brandChoice = brands.includes(match.name) ? match.name : OTHER_BRAND;
		}

		lookupResults = [];
		lookupSearched = false;
		lookupQuery = '';
		// The rest of the form is where the picked result is reviewed and corrected before saving: staying on
		// the search tab would hide the very fields that just got filled in.
		mode = 'manual';
	}

	const located = $derived(lat !== undefined && lng !== undefined);

	/**
	 * The shop's position, taken on site, through the pin in the address field.
	 *
	 * The device gives it, not a geocoding service: the address never leaves the phone, there is no API key
	 * and no quota, and it works without network. In exchange you have to be in front of the shop — which
	 * works out, since that is where you are when shopping.
	 *
	 * It serves to recognise the shop when you come back, to bring out the right loyalty card without
	 * looking for it. The pin only fills the coordinates: the address is still written by hand.
	 *
	 * In the form and not on the shop page: the position can now be set while creating the shop, where you
	 * used to have to create it then come back to its page.
	 */
	function capturePosition() {
		if (!navigator.geolocation) {
			gpsError = t('shops.geoUnavailable');
			return;
		}

		captured = true;
		gpsError = '';

		navigator.geolocation.getCurrentPosition(
			(position) => {
				lat = position.coords.latitude;
				lng = position.coords.longitude;
				captured = false;
				// When editing, the position stands for itself: you take it in front of the shop, not at the moment
				// you think of saving the rest of the form.
				if (editing) data.updateShop(editing.id, { lat, lng });
			},
			() => {
				gpsError = t('shops.geoDenied');
				captured = false;
			},
			{ enableHighAccuracy: true, timeout: 15000 }
		);
	}

	// The code of the shop being edited does not count as taken by another: keeping it as it is must stay
	// possible.
	const taken = $derived(
		data.shops.filter((shop) => shop.id !== editing?.id).map((shop) => shop.short)
	);

	/**
	 * The brands already typed in the household first, then the catalogue's well-known chains: what the
	 * family really goes to comes up before what it might. An independent shop simply matches none.
	 */
	const brands = $derived([
		...new Set([
			...data.shops.map((shop) => shop.brand.trim()).filter(Boolean),
			...BRANDS.map((entry) => entry.name)
		])
	]);

	const OTHER_BRAND = '__other__';

	/**
	 * The picker shows a known chain, or "Other" with its own text field — never a blank text box pretending
	 * to be a list. `brand` itself stays the source of truth the rest of the form (and the submit) reads;
	 * this only decides which control is on screen for it.
	 */
	let brandChoice = $state(
		untrack(() => (editing?.brand && !brands.includes(editing.brand) ? OTHER_BRAND : (editing?.brand ?? '')))
	);

	function pickBrandChoice(value: string) {
		brandChoice = value;
		if (value !== OTHER_BRAND) brand = value;
		else if (brands.includes(brand)) brand = '';
	}

	/** What the badge will carry if nobody fills the field. */
	const suggested = $derived(data.proposedShort({ brand, name, address }, editing?.id));

	const typed = $derived(short.trim().toUpperCase());

	/**
	 * A code already taken is refused rather than silently corrected: someone typing CMX has a reason to
	 * want it, and ending up with CM2 with no explanation is more confusing than reading that the place is
	 * taken.
	 */
	const alreadyTaken = $derived(typed.length > 0 && taken.some((short) => short.toUpperCase() === typed));

	/**
	 * Creating before the first sync has settled means picking a code and a tint from a still-empty cache:
	 * the shop then takes somebody else's. We wait, rather than having to fix afterwards a shop its own
	 * duplicate makes uneditable.
	 *
	 * On creation only: editing a shop assumes you can already see it.
	 */
	const attendSynchro = $derived(!editing && !sync.settled);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim() || alreadyTaken || attendSynchro) return;

		if (editing) {
			feedback.play('success');
			// A code left empty goes back to the one the badge already shows: we never clear it, a shop with no
			// badge does not exist.
			data.updateShop(editing.id, {
				brand: brand.trim(),
				name: name.trim(),
				address: address.trim(),
				short: typed || editing.short
			});
			onsaved?.();
			return;
		}

		feedback.play('add');
		const shop = data.addShop({
			brand,
			name,
			address,
			short,
			lat,
			lng,
			tint: findBrand(brand)?.color ?? TINTS[data.shops.length % TINTS.length]
		});

		brand = '';
		brandChoice = '';
		name = '';
		address = '';
		short = '';
		lat = undefined;
		lng = undefined;
		gpsError = '';
		mode = 'manual';
		oncreated?.(shop);
	}
</script>

<form onsubmit={submit} class="space-y-3" data-test-id="add-shop">
	{#if !editing}
		<!--
			Two modes, not a search box floating above a form that also always shows: someone typing a shop
			by hand should see exactly that, and nothing about a network search they are not going to use.
		-->
		<div
			role="tablist"
			aria-label={t('shops.new')}
			class="bg-muted grid grid-cols-2 gap-1 rounded-md p-1"
			data-test-id="shop-mode-tabs"
		>
			{#each [{ id: 'search', label: t('shops.modeSearch') }, { id: 'manual', label: t('shops.modeManual') }] as option (option.id)}
				<button
					type="button"
					role="tab"
					aria-selected={mode === option.id}
					onclick={() => (mode = option.id as 'search' | 'manual')}
					data-test-id="shop-mode-{option.id}"
					class="text-label min-h-[max(2.5rem,44px)] rounded-md px-3 py-1.5 font-medium transition-colors {mode ===
					option.id
						? 'bg-card shadow-sm'
						: 'text-muted-foreground'}"
				>
					{option.label}
				</button>
			{/each}
		</div>
	{/if}

	{#if !editing && mode === 'search'}
		<div class="space-y-2">
			<Label for="{prefix}-lookup">{t('shops.lookup')}</Label>
			<div class="flex gap-2">
				<div class="flex-1">
					<IconField icon={Search}>
						<Input
							id="{prefix}-lookup"
							bind:value={lookupQuery}
							data-test-id="shop-lookup"
							placeholder={t('shops.lookupPlaceholder')}
							onkeydown={(event) => {
								if (event.key === 'Enter') {
									event.preventDefault();
									runLookup();
								}
							}}
						/>
					</IconField>
				</div>
				<Button
					type="button"
					variant="outline"
					disabled={!lookupQuery.trim() || lookupBusy}
					onclick={runLookup}
					data-test-id="shop-lookup-run"
				>
					{lookupBusy ? t('shops.lookupSearching') : t('shops.lookupButton')}
				</Button>
			</div>
			<p class="text-muted-foreground text-caption">{t('shops.lookupHint')}</p>

			{#if lookupResults.length}
				<ul class="divide-border bg-card divide-y rounded-lg border" data-test-id="shop-lookup-results">
					{#each lookupResults as result (result.name + result.address)}
						<li>
							<button
								type="button"
								onclick={() => pickLookupResult(result)}
								class="hover:bg-muted focus-visible:ring-ring flex w-full flex-col items-start gap-0.5 p-3 text-start focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none"
								data-test-class="shop-lookup-result"
							>
								<span class="font-medium">{result.name}</span>
								<span class="text-muted-foreground text-caption">{result.address}</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else if lookupSearched && !lookupBusy}
				<p class="text-muted-foreground text-caption" role="status" data-test-id="shop-lookup-empty">
					{lookupError ? t('shops.lookupError') : t('shops.lookupEmpty')}
				</p>
			{/if}
		</div>
	{/if}

	{#if editing || mode === 'manual'}
	<div class="grid gap-3 sm:grid-cols-2">
		<!--
			The brand first, because it is what opens the three-letter code and what will carry the card.
			Optional and announced as such: a hairdresser has none, and the form must not give the impression
			that one is needed.

			A picker over the known chains, not free text: "Other" is its own choice, revealing a plain field
			for the chain the catalogue does not carry rather than pretending the list is complete.
		-->
		<div>
			<Label for="{prefix}-brand">{t('shops.brand')}</Label>
			<IconField icon={Building2}>
				<select
					id="{prefix}-brand"
					value={brandChoice}
					onchange={(event) => pickBrandChoice(event.currentTarget.value)}
					data-test-id="shop-brand"
					class="border-input bg-background min-h-[max(2.75rem,44px)] w-full rounded-md border"
				>
					<option value="">{t('shops.brandPlaceholder')}</option>
					{#each brands as option (option)}
						<option value={option}>{option}</option>
					{/each}
					<option value={OTHER_BRAND}>{t('shops.brandOther')}</option>
				</select>
			</IconField>
			{#if brandChoice === OTHER_BRAND}
				<Input
					bind:value={brand}
					data-test-id="shop-brand-other"
					placeholder={t('shops.brandOtherPlaceholder')}
					class="mt-2"
				/>
			{/if}
		</div>
		<div>
			<Label for="{prefix}-name">{t('shops.name')}</Label>
			<IconField icon={Store}>
				<Input
					id="{prefix}-name"
					bind:value={name}
					data-test-id="shop-name"
					required
					placeholder={t('shops.namePlaceholder')}
				/>
			</IconField>
		</div>
	</div>

	<div class="grid gap-3 sm:grid-cols-[1fr_9rem]">
		<div>
			<Label for="{prefix}-address">{t('shops.address')}</Label>
			<!--
				The pin is not decoration: it sets the position taken by the device. It does not touch the address
				written above — no geocoding service is called, and nothing typed leaves the phone.
			-->
			<IconField>
				<Input
					id="{prefix}-address"
					bind:value={address}
					data-test-id="shop-address"
					aria-describedby="{prefix}-address-hint"
					placeholder={t('shops.addressPlaceholder')}
				/>
				{#snippet action()}
					{@const label = captured
						? t('shops.locating')
						: located
							? t('shops.relocate')
							: t('shops.locate')}
					<button
						type="button"
						onclick={capturePosition}
						disabled={captured}
						aria-label={label}
						title={label}
						data-test-class="shop-locate"
						class={'hover:text-foreground focus-visible:ring-ring flex size-11 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none disabled:opacity-40 ' +
							(located ? 'text-primary' : 'text-muted-foreground')}
					>
						<MapPin size={18} aria-hidden="true" />
					</button>
				{/snippet}
			</IconField>
			<p id="{prefix}-address-hint" class="text-muted-foreground text-caption">
				{t('shops.addressHint')}
			</p>
			{#if gpsError}
				<p class="text-destructive text-caption" role="alert" data-test-id="shop-geo-error">
					{gpsError}
				</p>
			{/if}
		</div>
		<!--
			The field is not filled in: it shows as a placeholder what will be used if nobody touches it. A value
			written outright would look as if it had been typed, and you would have to clear it to get back to
			the automatic code.

			The button, on the other hand, writes the suggestion into the field — to tweak one letter of it, or
			to come back to it after correcting the brand or the town.
		-->
		<div>
			<Label for="{prefix}-short">{t('shops.short')}</Label>
			<IconField>
				<Input
					id="{prefix}-short"
					bind:value={short}
					data-test-id="shop-short"
					maxlength={3}
					placeholder={suggested}
					autocapitalize="characters"
					aria-invalid={alreadyTaken}
					aria-describedby={alreadyTaken ? `${prefix}-short-error` : undefined}
					class="text-center uppercase"
				/>
				{#snippet action()}
					<button
						type="button"
						onclick={() => (short = suggested)}
						disabled={!suggested}
						aria-label={t('shops.shortRegenerate')}
						title={t('shops.shortRegenerate')}
						data-test-id="shop-short-regenerate"
						class="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex size-11 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none disabled:opacity-40"
					>
						<RefreshCw size={18} aria-hidden="true" />
					</button>
				{/snippet}
			</IconField>
		</div>
	</div>

	{#if alreadyTaken}
		<p
			id="{prefix}-short-error"
			class="text-destructive text-caption"
			role="alert"
			data-test-id="shop-short-error"
		>
			{t('shops.shortTaken')}
		</p>
	{/if}
	{/if}

	{#if editing}
		<div class="flex flex-wrap items-stretch gap-2">
			<Button type="submit" data-test-class="shop-save">
				<Check size={18} aria-hidden="true" />
				{t('shops.save')}
			</Button>
			<Button type="button" variant="outline" onclick={() => oncancel?.()} data-test-class="shop-cancel">
				{t('shops.cancel')}
			</Button>
		</div>
	{:else if mode === 'manual'}
		<Button type="submit" disabled={attendSynchro} data-test-id="shop-create">
			<Plus size={18} aria-hidden="true" />
			{t('shops.new')}
		</Button>
		{#if attendSynchro}
			<p class="text-muted-foreground text-caption mt-2" role="status" data-test-id="shop-waiting">
				{t('shops.waitingSync')}
			</p>
		{/if}
	{/if}
</form>
