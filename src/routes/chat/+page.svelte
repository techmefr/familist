<script lang="ts">
	import { goto } from '$app/navigation';
	import { data } from '$stores/data.svelte';
	import { settings } from '$stores/settings.svelte';
	import { createIntent } from '$stores/create.svelte';
	import { ai } from '$stores/ai.svelte';
	import { i18n, t } from '$i18n/index.svelte';
	import * as Card from '$components/ui/card';
	import SearchFilterBar from '$components/app/SearchFilterBar.svelte';
	import FilterSheet from '$components/app/FilterSheet.svelte';
	import Avatar from '$components/app/Avatar.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';
	import { MessagesSquare, Sparkles } from '@lucide/svelte';

	/**
	 * Two scopes live side by side here. A list discussion is attached to its list — `list_id`, route
	 * `/l/[id]/chat` — and is shared with the circle. A private message, for its part, belongs to no circle:
	 * it is the choice that removes the ambiguity of two people who are members of several shared circles,
	 * and the reason the two do not mix on screen.
	 */
	const allRows = $derived(
		data.lists.map((list) => {
			const messages = data.messagesOf(list.id);
			return { list, last: messages.at(-1) };
		})
	);

	/** Which list conversations show: every one, only personal lists, or one particular household's. */
	let householdFilter = $state<'all' | 'personal' | string>('all');
	let listQuery = $state('');
	let barHeight = $state(0);
	let filterSheet = $state<FilterSheet | null>(null);
	const activeFilterCount = $derived(householdFilter === 'all' ? 0 : 1);

	const rows = $derived(
		allRows.filter(({ list }) => {
			if (householdFilter === 'personal' && list.householdId) return false;
			if (
				householdFilter !== 'all' &&
				householdFilter !== 'personal' &&
				list.householdId !== householdFilter
			)
				return false;

			const query = listQuery.trim().toLowerCase();
			return !query || list.name.toLowerCase().includes(query);
		})
	);

	let picking = $state(false);

	$effect(() => {
		if (createIntent.kind === 'direct' && createIntent.take('direct')) picking = true;
	});
	let failed = $state(false);

	async function open(otherId: string) {
		failed = false;

		const conversationId = await data.startDirect(otherId);
		if (!conversationId) {
			failed = true;
			return;
		}

		picking = false;
		await goto(`/chat/d/${conversationId}`);
	}

	/** The time of the last message, in the screen's language. Today the time, otherwise the date. */
	function when(createdAt: number) {
		const date = new Date(createdAt);
		if (Number.isNaN(date.getTime())) return '';

		const sameDay = new Date().toDateString() === date.toDateString();

		return new Intl.DateTimeFormat(
			i18n.locale,
			sameDay ? { hour: 'numeric', minute: '2-digit' } : { day: 'numeric', month: 'short' }
		).format(date);
	}

	const STAGGER_MS = 45;
	const STAGGER_MAX = 6;
	const delay = (index: number) => Math.min(index, STAGGER_MAX) * STAGGER_MS;

	/**
	 * One conversation list, WhatsApp style: the assistant is pinned on top, then private conversations and
	 * list chats together, the most recent message first. A household filter only concerns list chats, so
	 * turning it on leaves the private ones out rather than pretending they belong to a household.
	 */
	type Row =
		| { kind: 'direct'; id: string; lastAt: number; summary: (typeof data.directs)[number] }
		| { kind: 'list'; id: string; lastAt: number; entry: (typeof allRows)[number] };

	const conversations = $derived.by<Row[]>(() => {
		const wanted = listQuery.trim().toLowerCase();

		const directs: Row[] = data.directs
			.filter(summary => {
				if (householdFilter !== 'all') return false;
				const name = data.member(summary.otherId)?.name ?? '';
				return !wanted || name.toLowerCase().includes(wanted);
			})
			.map(summary => ({ kind: 'direct', id: summary.conversationId, lastAt: summary.lastAt, summary }));

		const lists: Row[] = rows.map(entry => ({
			kind: 'list',
			id: entry.list.id,
			lastAt: entry.last?.createdAt ?? 0,
			entry
		}));

		return [...directs, ...lists].toSorted((a, b) => b.lastAt - a.lastAt);
	});

	const hasAnything = $derived(allRows.length > 0 || data.directs.length > 0);
</script>

<svelte:head>
	<title>{t('chat.indexTitle')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('chat.indexTitle')}</h1>

{#if hasAnything}
	<SearchFilterBar
		bind:query={listQuery}
		bind:height={barHeight}
		active={activeFilterCount}
		onFilters={() => filterSheet?.show()}
		label={t('chat.listFilterSearch')}
		placeholder={t('chat.listFilterSearchPlaceholder')}
		testPrefix="chat-list"
	/>

	<FilterSheet
		bind:this={filterSheet}
		title={t('chat.listFilterHousehold')}
		active={activeFilterCount}
		onReset={() => (householdFilter = 'all')}
		testPrefix="chat-list-filter"
	>
		<div class="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label={t('chat.listFilterHousehold')}>
			{#each [{ id: 'all', name: t('chat.listFilterAll') }, { id: 'personal', name: t('chat.listFilterPersonal') }, ...data.circles] as option (option.id)}
				<label class="fl-choice">
					<input
						type="radio"
						name="chat-household"
						value={option.id}
						bind:group={householdFilter}
						class="sr-only"
						data-test-id="chat-list-filter-household-{option.id}"
					/>
					{option.name}
				</label>
			{/each}
		</div>
	</FilterSheet>
{/if}

{#if picking}
	<div class="bg-card mt-4 rounded-xl border p-4" data-test-id="direct-picker">
		<h2 class="text-label font-medium">{t('chat.newDirectTitle')}</h2>

		{#if data.directCandidates.length === 0}
			<p class="text-caption text-muted-foreground mt-2">{t('chat.noDirectCandidates')}</p>
		{:else}
			<ul class="mt-3 space-y-2">
				{#each data.directCandidates as candidate (candidate.id)}
					<li>
						<button
							type="button"
							onclick={() => open(candidate.id)}
							data-test-class="direct-candidate"
							class="hover:bg-muted flex min-h-[max(2.75rem,44px)] w-full items-center gap-3 rounded-md px-2 text-left"
						>
							<Avatar member={candidate} size={32} />
							<span class="text-label truncate">{candidate.name}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if failed}
			<p class="text-destructive text-caption mt-3" role="alert" data-test-id="direct-error">
				{t('chat.directFailed')}
			</p>
		{/if}
	</div>
{/if}

<ul class="mt-4 space-y-3" data-test-id="chat-list">
	<li>
		<a href="/chat/assistant" data-test-id="chat-assistant" class="fl-press block">
			<Card.Root class="border-primary/40 hover:border-primary transition-colors">
				<Card.Content class="flex items-center gap-3 py-4">
					<span
						class="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-full"
						aria-hidden="true"
					>
						<Sparkles size={18} />
					</span>
					<span class="min-w-0 flex-1">
						<span class="text-label block truncate font-medium">{t('chat.assistantName')}</span>
						<span class="text-caption text-muted-foreground block truncate">
							{ai.configured ? t('chat.assistantPreview') : t('recipes.create.needsKey')}
						</span>
					</span>
				</Card.Content>
			</Card.Root>
		</a>
	</li>

	{#each conversations as row, index (row.kind + row.id)}
		<li
			class:fl-rise={settings.animates}
			style={settings.animates ? `animation-delay: ${delay(index)}ms` : undefined}
		>
			{#if row.kind === 'direct'}
				{@const other = data.member(row.summary.otherId)}
				<a
					href="/chat/d/{row.summary.conversationId}"
					data-test-class="direct-entry"
					class="fl-press block"
				>
					<Card.Root class="hover:border-primary transition-colors">
						<Card.Content class="flex items-center gap-3 py-4">
							{#if other}
								<Avatar member={other} size={36} />
							{:else}
								<MessagesSquare size={18} class="text-muted-foreground shrink-0" aria-hidden="true" />
							{/if}

							<span class="min-w-0 flex-1">
								<span class="text-label block truncate font-medium">
									{other?.name ?? t('chat.someone')}
								</span>
								<span class="text-caption text-muted-foreground block truncate">
									{row.summary.lastBody || t('chat.empty')}
								</span>
							</span>

							{#if row.summary.lastAt > 0}
								<span class="text-caption text-muted-foreground shrink-0">
									{when(row.summary.lastAt)}
								</span>
							{/if}
						</Card.Content>
					</Card.Root>
				</a>
			{:else}
				{@const { list, last } = row.entry}
				<a href="/l/{list.id}/chat" data-test-class="chat-entry" class="fl-press block">
					<Card.Root class="hover:border-primary transition-colors">
						<Card.Content class="flex items-center gap-3 py-4">
							<span class="text-h2" aria-hidden="true">{list.emoji}</span>

							<span class="min-w-0 flex-1">
								<span class="text-label block truncate font-medium">{list.name}</span>
								<span class="text-caption text-muted-foreground block truncate">
									{last ? last.body : t('chat.empty')}
								</span>
							</span>

							{#if last}
								<span class="text-caption text-muted-foreground shrink-0">
									{when(last.createdAt)}
								</span>
							{:else}
								<MessagesSquare size={18} class="text-muted-foreground shrink-0" aria-hidden="true" />
							{/if}
						</Card.Content>
					</Card.Root>
				</a>
			{/if}
		</li>
	{/each}
</ul>

{#if hasAnything && conversations.length === 0}
	<EmptyState illustration="mascot" text={t('chat.listFilterEmpty')} testId="chat-list-filter-empty" />
{:else if !hasAnything}
	<EmptyState illustration="mascot" text={t('chat.indexEmpty')} testId="chats-empty" />
{/if}

{#if hasAnything}
	<div class="md:hidden" aria-hidden="true" style="height: calc({barHeight}px + var(--fl-navbar-h, 4rem) + 0.75rem)"></div>
{/if}
