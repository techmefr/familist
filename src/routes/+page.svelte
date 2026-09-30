<script lang="ts">
	import { browser } from '$app/environment';
	import { flip } from 'svelte/animate';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { data } from '$stores/data.svelte';
	import type { ListKind } from '$db/schema';
	import { feedback } from '$stores/feedback.svelte';
	import { motionMs, settings } from '$stores/settings.svelte';
	import { DURATION } from '$domain/motion-tokens';
	import { createIntent } from '$stores/create.svelte';
	import { i18n, t } from '$i18n/index.svelte';
	import { TINTS, DEFAULT_TINT } from '$domain/tint';
	import { themedTint } from '$domain/theme-tints';
	import { reminderStatus } from '$domain/reminder';
	import { remindersSupported, requestReminderPermission } from '$native/reminders';
	import * as Card from '$components/ui/card';
	import { Badge } from '$components/ui/badge';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import EmojiPicker from '$components/app/EmojiPicker.svelte';
	import Avatar from '$components/app/Avatar.svelte';
	import ActionSheet from '$components/app/ActionSheet.svelte';
	import { longpress } from '$components/app/longpress.svelte';
	import type { Action } from '$domain/action-sheet';
	import type { List } from '$db/schema';
	import {
		Plus,
		Trash2,
		Pencil,
		Copy,
		ListChecks,
		CalendarDays,
		Users,
		Lock,
		Check,
		UtensilsCrossed,
		MoreVertical,
		Search,
		SlidersHorizontal,
		X
	} from '@lucide/svelte';
	import IconField from '$components/app/IconField.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';

	let creating = $state(false);
	let name = $state('');
	let emoji = $state('🛒');
	let picker = $state<EmojiPicker | null>(null);
	let eventDate = $state('');
	let kind = $state<ListKind>('shopping');

	/**
	 * Personal, or a given household: chosen when the list is born, editable later from the long-press
	 * menu's Share action. `''` means personal — a household id never is one, so the two cannot collide.
	 */
	let scope = $state('');

	const LAST_SCOPE_KEY = 'familist:last-list-scope';

	/**
	 * Personal by default, unless a household was used last time and still exists, or there is exactly one
	 * to choose from — then asking would be a step for nothing.
	 */
	function defaultScope() {
		const last = browser ? localStorage.getItem(LAST_SCOPE_KEY) : null;
		if (last && data.circles.some((circle) => circle.id === last)) return last;
		if (data.circles.length === 1) return data.circles[0].id;
		return '';
	}

	function chooseScope(id: string) {
		scope = id;
		if (browser && id) localStorage.setItem(LAST_SCOPE_KEY, id);
	}

	/** Which lists show on the overview: every one, only the shopping lists, or only the meal plans. */
	let kindFilter = $state<'all' | ListKind>('all');

	/** Personal, a given household, or every list regardless of who it belongs to. */
	let scopeFilter = $state('all');

	/** The name search, folded up behind the search button until tapped. */
	let searchOpen = $state(false);
	let searchQuery = $state('');

	let filterSheet = $state<HTMLDialogElement | null>(null);
	let barHeight = $state(0);
	const activeFilterCount = $derived(
		(kindFilter !== 'all' ? 1 : 0) + (scopeFilter !== 'all' ? 1 : 0)
	);

	const visibleLists = $derived(
		data.lists.filter((list) => {
			if (kindFilter !== 'all' && list.kind !== kindFilter) return false;
			if (scopeFilter === 'mine' && list.householdId) return false;
			if (scopeFilter !== 'all' && scopeFilter !== 'mine' && list.householdId !== scopeFilter)
				return false;
			if (searchQuery.trim() && !list.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
				return false;
			return true;
		})
	);

	/** Set only after a save, when the person refused notifications. */
	let reminderRefused = $state(false);

	/** The list being renamed. The same form serves to create and to correct. */
	let renamed = $state<string | null>(null);

	/** The list the action menu (long-press, or its "⋯" button) currently reads about. */
	let actionsFor = $state<List | null>(null);
	let actionSheet = $state<ActionSheet | null>(null);

	function openActions(list: List) {
		feedback.play('tap');
		actionsFor = list;
		actionSheet?.show();
	}

	const listActions = $derived.by((): Action[] => {
		if (!actionsFor) return [];
		const list = actionsFor;

		return [
			{
				id: 'edit',
				label: t('lists.rename', { name: list.name }),
				icon: Pencil,
				onSelect: () => rename(list)
			},
			{
				id: 'duplicate',
				label: t('lists.duplicate', { name: list.name }),
				icon: Copy,
				onSelect: () => {
					feedback.play('add');
					data.duplicateList(list.id);
				}
			},
			{
				id: 'delete',
				label: t('lists.delete', { name: list.name }),
				icon: Trash2,
				destructive: true,
				onSelect: () => {
					feedback.play('remove');
					data.removeList(list.id);
				}
			}
		];
	});

	/**
	 * Opening the form on an existing list, by long-pressing its card.
	 *
	 * The name and the emoji are corrected in the same place they are set: a second form would only have
	 * repeated the same two fields and the same palette.
	 */
	function rename(list: {
		id: string;
		name: string;
		emoji: string;
		eventDate?: string;
		kind: ListKind;
		householdId?: string;
	}) {
		feedback.play('tap');
		renamed = list.id;
		name = list.name;
		emoji = list.emoji;
		eventDate = list.eventDate ?? '';
		kind = list.kind;
		scope = list.householdId ?? '';
		reminderRefused = false;
		creating = true;

		// The form is at the top of the page, the card can be far below.
		window.scrollTo({ top: 0, behavior: settings.animates ? 'smooth' : 'auto' });
	}

	function cancel() {
		renamed = null;
		name = '';
		emoji = '🛒';
		eventDate = '';
		kind = 'shopping';
		scope = '';
		reminderRefused = false;
		creating = false;
	}

	/**
	 * The central button announces what it comes for. Here it is the folded form that has to open:
	 * without that, the cursor would have no field to land in on arrival.
	 */
	$effect(() => {
		if (createIntent.take('list')) {
			scope = defaultScope();
			creating = true;
		}
	});

	const stats = (listId: string) => {
		const items = data.itemsOf(listId);
		return { total: items.length, done: items.filter((i) => i.checked).length };
	};

	/**
	 * Who sees this list.
	 *
	 * Faces rather than a count: you recognise a stack of two avatars without reading it, where "2 members"
	 * asks you to stop on it. And the private / shared distinction is what decides whether you can write a
	 * birthday surprise in it.
	 */
	const membersOf = (list: { memberIds: string[] }) =>
		list.memberIds
			.map((id) => data.member(id))
			.filter((member): member is NonNullable<typeof member> => Boolean(member));

	/**
	 * An event date, written in the screen's language.
	 *
	 * It is stored as ISO — a date is not a string to translate — and formatted here: "14 février" in
	 * French, "February 14" in English. An invalid date is simply ignored rather than making "Invalid Date"
	 * appear on the card.
	 */
	function eventLabel(iso: string) {
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return '';

		return new Intl.DateTimeFormat(i18n.locale, { day: 'numeric', month: 'long' }).format(date);
	}

	/**
	 * What the reminder will really do, written under the field at the moment the date is typed.
	 *
	 * The application is a static bundle with no server: the reminder is an alarm set on the device, and
	 * the browser cannot set one. Rather than suggesting a reminder that will never fire, we say so at the
	 * exact place the promise is made.
	 */
	const reminderNotice = $derived.by(() => {
		if (!eventDate) return '';
		if (!remindersSupported()) return t('lists.reminderWeb');

		const { status, at } = reminderStatus(eventDate, new Date());
		if (status === 'invalid') return t('lists.reminderInvalid');
		if (status === 'late') return t('lists.reminderLate');

		const when = new Intl.DateTimeFormat(i18n.locale, {
			dateStyle: 'long',
			timeStyle: 'short'
		}).format(at as Date);

		return t('lists.reminderPlanned', { when });
	});

	/**
	 * The permission is asked for here, on the gesture that sets the date, and not at launch.
	 *
	 * Android 13 only offers it twice: spending it at startup, before anyone has expressed the need for a
	 * reminder, would amount to losing it. A refusal blocks nothing — the date is already saved, only the
	 * notification is missing, and we say so.
	 */
	async function requestReminder() {
		const permission = await requestReminderPermission();
		reminderRefused = permission === 'denied';
	}

	function create(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim()) return;

		const hasDate = Boolean(eventDate);

		if (renamed) {
			feedback.play('success');
			data.updateList(renamed, { name, emoji, eventDate, kind });
		} else {
			feedback.play('add');
			data.addList({
				name,
				emoji,
				eventDate,
				kind,
				householdId: scope || undefined,
				color: TINTS[data.lists.length % TINTS.length]
			});
		}

		cancel();
		if (hasDate) void requestReminder();
	}

	/**
	 * The cards come in one after another, top to bottom. The delay is capped: at fifteen lists, a full
	 * cascade would make the last card wait a whole second.
	 */
	const STAGGER_MS = 45;
	const STAGGER_MAX = 6;
	const delay = (index: number) => Math.min(index, STAGGER_MAX) * STAGGER_MS;

	/** The shape of the stack while it loads: three cards, the usual size of a household's home. */
	const SKELETON_COUNT = 3;

	const actionClass =
		'fl-press text-muted-foreground hover:text-foreground hover:bg-muted grid size-11 min-w-[44px] ' +
		'place-items-center rounded-full transition-colors';

	function openCreate() {
		feedback.play('tap');
		scope = defaultScope();
		creating = true;
	}
</script>

<svelte:head>
	<title>{t('lists.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('lists.title')}</h1>

{#if creating}
	<form
		onsubmit={create}
		transition:slide={{ duration: motionMs(DURATION.enter), easing: cubicOut }}
		class="fl-home-card bg-card mt-6 space-y-3 p-4"
	>
		<div class="grid gap-3 sm:grid-cols-[auto_1fr]">
			<div class="w-20">
				<Label for="list-emoji">{t('lists.emoji')}</Label>
	<!-- Same palette as for aisles: an emoji is not typed on a computer keyboard. -->
			<button
				type="button"
				id="list-emoji"
				onclick={() => picker?.show()}
				aria-haspopup="dialog"
				data-test-id="list-emoji"
				class="border-input bg-background fl-press grid min-h-[max(2.75rem,44px)] w-full place-items-center rounded-lg border text-2xl"
			>
				<span aria-hidden="true">{emoji}</span>
				<span class="sr-only">{t('emojiPicker.current', { emoji: emoji })}</span>
			</button>
			</div>
			<div>
				<Label for="list-name">{t('lists.name')}</Label>
				<IconField icon={ListChecks}>
					<Input
						id="list-name"
						bind:value={name}
						data-test-id="list-name"
						required
						placeholder={t('lists.namePlaceholder')}
					/>
				</IconField>
			</div>
		</div>
		<div>
			<Label for="list-event-date">{t('lists.eventDate')}</Label>
			<IconField icon={CalendarDays}>
				<Input
					id="list-event-date"
					type="date"
					bind:value={eventDate}
					data-test-id="list-event-date"
					aria-describedby="list-event-date-help"
				/>
			</IconField>
			<p id="list-event-date-help" class="text-caption text-muted-foreground mt-1">
				{reminderNotice || t('lists.eventDateClear')}
			</p>
		</div>
		<fieldset>
			<legend class="text-label mb-2 font-medium">{t('lists.kindLabel')}</legend>
			<div class="flex flex-wrap gap-2" data-test-id="list-kind">
				{#each [{ id: 'shopping', label: t('lists.kindShopping'), icon: ListChecks }, { id: 'meal-plan', label: t('lists.kindMealPlan'), icon: UtensilsCrossed }] as option (option.id)}
					{@const Icon = option.icon}
					<Label
						class="border-input has-checked:border-primary has-checked:bg-[var(--fl-primary-tint)] has-focus-visible:ring-ring has-focus-visible:ring-2 flex min-h-[max(2.75rem,44px)] cursor-pointer items-center gap-2 rounded-md border px-3 py-2"
					>
						<input
							type="radio"
							name="list-kind"
							value={option.id}
							bind:group={kind}
							data-test-id="list-kind-{option.id}"
							class="sr-only"
						/>
						<Icon size={16} aria-hidden="true" />
						{option.label}
					</Label>
				{/each}
			</div>
		</fieldset>
		<!--
			Personal or a household, decided as the list is born rather than through a second trip via the
			long-press menu. Big buttons and faces: a name in a dropdown would ask you to read it, where the
			avatars are recognised the way the household's own members are, everywhere else in the app.
		-->
		{#if !renamed && data.circles.length > 0}
			<fieldset>
				<legend class="text-label mb-2 font-medium">{t('lists.scopeLabel')}</legend>
				<div class="grid grid-cols-1 gap-2 sm:grid-cols-2" data-test-id="list-scope">
					<Label
						class="border-input has-checked:border-primary has-checked:bg-[var(--fl-primary-tint)] has-focus-visible:ring-ring has-focus-visible:ring-2 flex min-h-[max(3.5rem,56px)] cursor-pointer items-center gap-2 rounded-lg border px-3 py-2"
					>
						<input
							type="radio"
							name="list-scope"
							class="sr-only"
							checked={scope === ''}
							onchange={() => chooseScope('')}
							data-test-id="list-scope-personal"
						/>
						<Lock size={16} aria-hidden="true" />
						<span class="text-label font-medium">{t('lists.scopePersonal')}</span>
					</Label>
					{#each data.circles as circle (circle.id)}
						{@const members = data.membersOf(circle.id)}
						<Label
							class="border-input has-checked:border-primary has-checked:bg-[var(--fl-primary-tint)] has-focus-visible:ring-ring has-focus-visible:ring-2 flex min-h-[max(3.5rem,56px)] cursor-pointer items-center gap-2 rounded-lg border px-3 py-2"
						>
							<input
								type="radio"
								name="list-scope"
								class="sr-only"
								checked={scope === circle.id}
								onchange={() => chooseScope(circle.id)}
								data-test-id="list-scope-{circle.id}"
							/>
							<span class="flex items-center" aria-hidden="true">
								{#each members.slice(0, 3) as member, rank (member.id)}
									<span class={rank === 0 ? '' : '-ms-2'}>
										<Avatar {member} size={22} ring />
									</span>
								{/each}
							</span>
							<span class="text-label min-w-0 truncate font-medium">{circle.name}</span>
						</Label>
					{/each}
				</div>
			</fieldset>
		{/if}
		<div class="flex flex-wrap items-stretch gap-2">
			<Button type="submit" data-test-id="list-create" class="fl-press flex-auto rounded-full">
				{t('common.save')}
			</Button>
			<Button
				type="button"
				variant="outline"
				onclick={cancel}
				data-test-id="list-form-cancel"
				class="fl-press rounded-full"
			>
				{t('common.cancel')}
			</Button>
		</div>
	</form>
{/if}

<!--
	The refusal arrives after the form closes: the system's answer is asynchronous, and showing it in a
	field already put away would go unseen. It is announced, not only displayed — it is the only
	information on the page that cannot be guessed by looking.
-->
{#if reminderRefused}
	<p class="text-caption text-destructive mt-4" role="status" data-test-id="reminder-denied">
		{t('lists.reminderDenied')}
	</p>
{/if}

{#if !data.ready}
	<!--
		The placeholders draw the stack that is about to appear, so the screen does not jump from a sentence
		to three cards. The sentence stays for the screen reader, which cannot read a shape.
	-->
	<p class="sr-only" role="status">{t('common.loading')}</p>
	<ul class="mt-6 space-y-3" aria-hidden="true">
		{#each { length: SKELETON_COUNT } as _, index (index)}
			<li class="fl-home-card bg-card flex items-center gap-4 p-4">
				<span class="fl-home-skeleton size-12 shrink-0 rounded-2xl"></span>
				<span class="flex-1 space-y-2.5">
					<span class="fl-home-skeleton block h-4 w-2/5"></span>
					<span class="fl-home-skeleton block h-3 w-3/5"></span>
				</span>
			</li>
		{/each}
	</ul>
{:else if data.lists.length === 0}
	<!--
		The first screen of a new household. It borrows the sign-in screen's glow and card: the person has just
		come from there, and the home should feel like the same product welcoming them, not a blank table. The
		one thing to do is a real button, not a dashed outline at the bottom of nothing.
	-->
	<div class="fl-auth-glow" aria-hidden="true"></div>
	<div class="fl-auth-card fl-rise mt-6">
		<EmptyState illustration="lists" text={t('lists.empty')} testId="lists-empty">
			{#snippet action()}
				{#if !creating}
					<Button
						type="button"
						onclick={openCreate}
						data-test-id="new-list-card"
						class="fl-press fl-auth-submit mt-2 w-full max-w-xs"
					>
						<Plus size={20} aria-hidden="true" />
						{t('lists.new')}
					</Button>
					{#if data.recipes.length > 0}
						<a
							href="/meal-plan"
							data-test-id="lists-empty-meal-plan-link"
							class="text-accent-foreground text-label mt-3 inline-flex items-center gap-1 font-medium"
						>
							<CalendarDays size={18} aria-hidden="true" />
							{t('lists.mealPlanSuggestion')}
						</a>
					{/if}
				{/if}
			{/snippet}
		</EmptyState>
	</div>
{:else}
	<!--
		Same reasoning as the recipes and cards bars (#402): a control used this much has no business at the
		top of the screen on a phone, where reaching it means changing grip. `fl-above-nav` floats it above
		the nav bar under 48rem and puts it back at the top of the flow past that width, exactly where it
		already was.

		A search button and a filter button, not a permanent panel of pills: the pills stayed on screen at
		all times whether or not anyone cared, eating space above every list. Search unfolds in place;
		filters (kind, and scope down to one specific household) live in a sheet opened on demand.
	-->
	<div
		bind:clientHeight={barHeight}
		class="fl-above-nav border-border bg-card/82 mt-6 flex items-center gap-2 rounded-full border p-2 shadow-fl-3 backdrop-blur-2xl"
	>
		{#if searchOpen}
			<div class="min-w-0 flex-1">
				<IconField icon={Search}>
					<Input
						bind:value={searchQuery}
						placeholder={t('lists.searchPlaceholder')}
						autofocus
						data-test-id="lists-search-input"
					/>
				</IconField>
			</div>
			<button
				type="button"
				onclick={() => {
					searchOpen = false;
					searchQuery = '';
				}}
				aria-label={t('common.close')}
				data-test-id="lists-search-close"
				class="fl-press text-muted-foreground flex size-11 shrink-0 items-center justify-center"
			>
				<X size={20} aria-hidden="true" />
			</button>
		{:else}
			<button
				type="button"
				onclick={() => (searchOpen = true)}
				aria-label={t('lists.search')}
				data-test-id="lists-search-open"
				class="fl-press text-foreground flex size-11 shrink-0 items-center justify-center rounded-full"
			>
				<Search size={20} aria-hidden="true" />
			</button>

			<span class="bg-border h-6 w-px shrink-0"></span>

			<button
				type="button"
				onclick={() => filterSheet?.showModal()}
				aria-haspopup="dialog"
				data-test-id="lists-filters-open"
				class="fl-press text-label text-foreground flex min-h-[max(2.75rem,44px)] flex-1 items-center justify-center gap-2 rounded-full font-medium"
			>
				<SlidersHorizontal size={18} aria-hidden="true" />
				{t('lists.filters')}
				{#if activeFilterCount > 0}
					<span
						class="bg-primary text-primary-foreground text-caption flex size-5 items-center justify-center rounded-full"
						data-test-id="lists-filters-count"
						aria-hidden="true"
					>
						{activeFilterCount}
					</span>
					<span class="sr-only">{t('common.filtersActive', { count: activeFilterCount })}</span>
				{/if}
			</button>
		{/if}
	</div>

	<dialog
		bind:this={filterSheet}
		onclick={(event) => {
			if (event.target === filterSheet) filterSheet?.close();
		}}
		class="fl-sheet"
		aria-label={t('lists.filters')}
		data-test-id="lists-filter-sheet"
	>
		<div class="bg-card space-y-4 rounded-t-2xl border p-4 md:rounded-2xl">
			<div>
				<p class="text-caption text-muted-foreground mb-2 font-medium">{t('lists.kindFilterLabel')}</p>
				<!-- No "All" pill (#402): tapping the active one again clears it, same as never having tapped it. -->
				<div class="flex flex-wrap gap-2" data-test-id="lists-kind-filter">
					{#each [{ id: 'shopping', label: t('lists.kindShopping') }, { id: 'meal-plan', label: t('lists.kindMealPlan') }] as option (option.id)}
						<button
							type="button"
							onclick={() =>
								(kindFilter = kindFilter === option.id ? 'all' : (option.id as ListKind))}
							aria-pressed={kindFilter === option.id}
							data-test-id="lists-kind-filter-{option.id}"
							class="fl-press text-label rounded-full px-3 py-1.5 font-medium {kindFilter ===
							option.id
								? 'bg-primary text-primary-foreground'
								: 'bg-muted text-foreground'}"
						>
							{option.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Personal, a household, or everything: the same split as the choice made at creation, read backwards. -->
			{#if data.circles.length > 0}
				<div>
					<p class="text-caption text-muted-foreground mb-2 font-medium">{t('lists.scopeFilterLabel')}</p>
					<!-- No "All" pill (#402): tapping the active one again clears it. -->
					<div class="flex flex-wrap gap-2" data-test-id="lists-scope-filter">
						{#each [{ id: 'mine', label: t('lists.scopePersonal') }, ...data.circles.map((circle) => ({ id: circle.id, label: circle.name }))] as option (option.id)}
							<button
								type="button"
								onclick={() => (scopeFilter = scopeFilter === option.id ? 'all' : option.id)}
								aria-pressed={scopeFilter === option.id}
								data-test-id="lists-scope-filter-{option.id}"
								class="fl-press text-caption rounded-full px-3 py-1 font-medium {scopeFilter ===
								option.id
									? 'bg-secondary text-secondary-foreground'
									: 'bg-muted text-foreground'}"
							>
								{option.label}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<Button
				type="button"
				variant="ghost"
				class="w-full"
				onclick={() => filterSheet?.close()}
				data-test-id="lists-filter-apply"
			>
				{t('lists.filterApply')}
			</Button>
		</div>
	</dialog>

	{#if visibleLists.length === 0}
		<p class="text-muted-foreground text-label mt-6" data-test-id="lists-kind-filter-empty">
			{t('lists.kindFilterEmpty')}
		</p>
	{/if}

	<ul class="mt-3 space-y-3">
		{#each visibleLists as list, index (list.id)}
			{@const { total, done } = stats(list.id)}
			<li
				class="fl-rise"
				style="animation-delay: {delay(index)}ms"
				animate:flip={{ duration: motionMs(DURATION.leave), easing: cubicOut }}
				out:slide={{ duration: motionMs(DURATION.tap), easing: cubicOut }}
			>
				<Card.Root data-test-class="list-card" class="fl-home-card fl-press ring-0">
					<Card.Content class="flex flex-wrap items-center gap-x-4 gap-y-3">
						<!--
							The long press opens the action menu (#353): Edit, Duplicate, Delete, shared with cards and
							loyalty cards rather than a menu rebuilt per screen. The "⋯" button below repeats the same
							menu for the keyboard and the screen reader, which cannot feel a held finger.
						-->
						<a
							href="/l/{list.id}"
							use:longpress={() => openActions(list)}
							class="flex min-w-0 flex-auto flex-wrap items-center gap-4"
						>
							<span
								class="fl-home-emoji text-h1"
								style="--fl-home-tint: {themedTint(list.color || DEFAULT_TINT, settings.themeId)}"
								aria-hidden="true"
							>
								{list.emoji}
							</span>
							<span class="min-w-0 flex-1 basis-[6rem]">
								<!-- The "X restants" badge on the right already says this (#401): one number, not two. -->
								<span class="text-product block font-semibold break-words">{list.name}</span>
								{#if list.kind === 'meal-plan'}
									<span
										class="text-caption text-secondary mt-1.5 mr-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--fl-secondary-tint)] px-2 py-0.5 font-semibold"
										data-test-class="list-kind-badge"
									>
										<UtensilsCrossed size={12} aria-hidden="true" />
										{t('lists.kindMealPlan')}
									</span>
								{/if}
								{#if list.eventDate && eventLabel(list.eventDate)}
									<!--
										The date of a family meal or a birthday: it is what says how long the list is useful for, and it
										was modelled without ever being displayed.
									-->
									<span
										class="text-caption text-secondary mt-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--fl-secondary-tint)] px-2 py-0.5 font-semibold"
										data-test-class="list-date"
									>
										<CalendarDays size={12} aria-hidden="true" />
										{eventLabel(list.eventDate)}
									</span>
								{/if}
							</span>
						</a>
						<!--
							The count and the bin travel together. Apart, they fought over the end of the first line and the bin
							fell alone onto the next one, on the left: the most destructive action ended up in the most visible
							place.
						-->
						<div class="ms-auto flex shrink-0 items-center gap-1.5">
							<!--
								A finished list earns its tick: "0 remaining" is true but reads like an error, where the green
								pill says the errand is done. The number keeps speaking for every other state.
							-->
							{#if total > 0 && done === total}
								<Badge
									variant="secondary"
									class="text-secondary gap-1 rounded-full bg-[var(--fl-secondary-tint)] font-semibold"
								>
									<Check size={12} aria-hidden="true" />
									{t('lists.remaining', { count: 0 })}
								</Badge>
							{:else}
								<Badge variant="secondary" class="rounded-full">
									{t('lists.remaining', { count: total - done })}
								</Badge>
							{/if}
							<button
								type="button"
								onclick={() => openActions(list)}
								aria-label={t('lists.actionsFor', { name: list.name })}
								aria-haspopup="dialog"
								data-test-class="list-actions"
								class={actionClass}
							>
								<MoreVertical size={18} aria-hidden="true" />
							</button>
						</div>
					</Card.Content>

					<!--
						The card footer answers "who else sees this". The avatars overlap because a household rarely has
						more than five and a tight stack reads at a glance; the word beside it is there because the stack
						alone does not say whether you are alone.
					-->
					<Card.Footer class="text-caption text-muted-foreground flex items-center gap-2">
						{@const members = membersOf(list)}
						{#if members.length > 1}
							<span class="flex items-center" data-test-class="list-members">
								{#each members.slice(0, 4) as member, rank (member.id)}
									<span class={rank === 0 ? '' : '-ms-2'}>
										<Avatar member={member} size={26} ring />
									</span>
								{/each}
								{#if members.length > 4}
									<span class="ms-1.5">+{members.length - 4}</span>
								{/if}
							</span>
							<span class="inline-flex items-center gap-1 font-medium">
								<Users size={13} aria-hidden="true" />
								{t('lists.shared')}
							</span>
						{:else}
							<span class="inline-flex items-center gap-1 font-medium" data-test-class="list-private">
								<Lock size={13} aria-hidden="true" />
								{t('lists.private')}
							</span>
						{/if}
					</Card.Footer>
				</Card.Root>
			</li>
		{/each}
	</ul>

	<!--
		On a phone the bar floats over the end of the wall: this keeps the last card clear of it. Its own
		height alone is not enough - `.fl-above-nav` also lifts it `inset-block-end: calc(var(--fl-navbar-h) +
		0.75rem)` above the viewport bottom, so the spacer has to cover that gap too, and it must be the very
		last element so scrolling to the true bottom actually reveals what is above it.
	-->
	<div
		class="md:hidden"
		style="height: calc({barHeight}px + var(--fl-navbar-h, 4rem) + 0.75rem)"
		aria-hidden="true"
	></div>
{/if}


<EmojiPicker bind:this={picker} value={emoji} onpick={(choices) => (emoji = choices)} />

<ActionSheet bind:this={actionSheet} title={actionsFor?.name ?? ''} actions={listActions} />
