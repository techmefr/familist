<script lang="ts">
	/** Messages from the same person closer than this read as one run and share a single name line. */
	const GROUP_GAP_MS = 5 * 60 * 1000;
	import AnimatedIcon from '$components/app/AnimatedIcon.svelte';
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { t, i18n } from '$i18n/index.svelte';
	import PollCard from '$components/app/PollCard.svelte';
	import ActionSheet from '$components/app/ActionSheet.svelte';
	import type { Action } from '$domain/action-sheet';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import {
		ArrowLeft,
		Plus,
		Search,
		X,
		CalendarDays,
		UtensilsCrossed,
		MessageCircleQuestionMark,
		ImagePlus,
		List
	} from '@lucide/svelte';
	import IconField from '$components/app/IconField.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';
	import ChatPhoto from '$components/app/ChatPhoto.svelte';
	import ChatPhotoPicker from '$components/app/ChatPhotoPicker.svelte';

	const listId = $derived(page.params.id!);
	const list = $derived(data.list(listId));
	const allMessages = $derived(data.messagesOf(listId));

	let searchOpen = $state(false);
	let searchQuery = $state('');
	let searchInput = $state<HTMLInputElement | null>(null);

	const messages = $derived(
		searchQuery.trim()
			? allMessages.filter((message) =>
					message.body.toLowerCase().includes(searchQuery.trim().toLowerCase())
				)
			: allMessages
	);

	async function toggleSearch() {
		searchOpen = !searchOpen;
		if (searchOpen) {
			await tick();
			searchInput?.focus();
		} else {
			searchQuery = '';
		}
	}

	let body = $state('');
	let bodyFocused = $state(false);
	let composing = $state<'date' | 'apport' | null>(null);
	let question = $state('');
	let choices = $state('');
	let pollError = $state(false);

	let composeSheet = $state<ActionSheet | null>(null);

	const composeActions = $derived.by((): Action[] => [
		{
			id: 'date',
			label: t('chat.composeDate'),
			icon: CalendarDays,
			onSelect: () => openPoll('date')
		},
		{
			id: 'apport',
			label: t('chat.composeApport'),
			icon: UtensilsCrossed,
			onSelect: () => openPoll('apport')
		},
		{
			id: 'ai',
			label: t('chat.composeAi'),
			icon: MessageCircleQuestionMark,
			onSelect: () => {
				feedback.play('tap');
				void goto('/recipes/new', { state: { recipeSource: 'ai' } });
			}
		},
		{
			id: 'photo',
			label: t('chat.composePhoto'),
			icon: ImagePlus,
			onSelect: () => {
				feedback.play('tap');
				photoPicker?.show();
			}
		}
	]);

	let photoPicker = $state<ChatPhotoPicker | null>(null);

	/**
	 * A photo needs a connection to upload (#366) — there is no offline queue for it like there is for text.
	 * Once the upload succeeds, the message it belongs to is created exactly like a text message, through the
	 * same `sendMessage`.
	 */
	function sendPhoto(photoPath: string) {
		data.sendMessage(listId, '', photoPath);
	}

	/**
	 * Parts of a meal: these are the ones the prototype offers, and they cover almost everything. Indexed by
	 * a stable key and not by label, otherwise the emoji can no longer be found as soon as the current
	 * language is not French.
	 */
	const CONTRIBUTION_PRESET = [
		{ key: 'aperitif', emoji: '🍾' },
		{ key: 'starter', emoji: '🍞' },
		{ key: 'main', emoji: '🥘' },
		{ key: 'dessert', emoji: '🍰' }
	];

	const contributionEmojis = () =>
		new Map(CONTRIBUTION_PRESET.map((p) => [t(`chat.apportPreset.${p.key}`), p.emoji]));

	function send(event: SubmitEvent) {
		event.preventDefault();
		if (!body.trim()) return;

		data.sendMessage(listId, body);
		body = '';
	}

	function openPoll(kind: 'date' | 'apport') {
		composing = kind;
		pollError = false;
		question = kind === 'date' ? t('chat.dateQuestion') : t('chat.apportQuestion');
		choices =
			kind === 'apport'
				? CONTRIBUTION_PRESET.map((p) => t(`chat.apportPreset.${p.key}`)).join('\n')
				: '';
	}

	function createPoll(event: SubmitEvent) {
		event.preventDefault();
		if (!composing) return;

		const emojis = contributionEmojis();
		const labels = choices
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean)
			.map((label) => ({
				label,
				emoji: emojis.get(label)
			}));

		if (labels.length === 0) {
			pollError = true;
			return;
		}

		pollError = false;
		data.createPoll(listId, composing, question, labels);
		composing = null;
	}

	const time = (at: number) =>
		new Intl.DateTimeFormat(i18n.locale, { timeStyle: 'short' }).format(new Date(at));
</script>

<svelte:head>
	<title>{t('chat.title')} — {list?.name ?? t('app.name')}</title>
</svelte:head>

{#if !data.ready}
	<p class="text-muted-foreground">{t('common.loading')}</p>
{:else if !list}
	<p class="text-muted-foreground">{t('list.notFound')}</p>
	<a href="/" class="text-primary mt-4 inline-block underline">{t('list.back')}</a>
{:else}
	<a
		href="/l/{listId}"
		class="text-muted-foreground text-label inline-flex min-h-[max(2.75rem,44px)] items-center gap-2"
	>
		<ArrowLeft size={16} aria-hidden="true" />
		{t('chat.backToList')}
	</a>

	<div class="mt-2 flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-h1 flex items-center gap-3 font-semibold">
			<span aria-hidden="true">{list.emoji}</span>
			{list.name}
		</h1>
		<button
			type="button"
			onclick={toggleSearch}
			aria-expanded={searchOpen}
			aria-label={t('chat.searchOpen')}
			data-test-id="chat-search-toggle"
			class="fl-press bg-muted text-foreground grid size-11 min-w-[44px] shrink-0 place-items-center rounded-full"
		>
			<Search size={18} aria-hidden="true" />
		</button>
	</div>

	{#if searchOpen}
		<div class="mt-3 flex items-center gap-2">
			<div class="flex-1">
				<IconField icon={Search}>
					<Input
						bind:ref={searchInput}
						bind:value={searchQuery}
						data-test-id="chat-search-input"
						placeholder={t('chat.searchPlaceholder')}
					/>
				</IconField>
			</div>
			<button
				type="button"
				onclick={toggleSearch}
				aria-label={t('chat.searchClose')}
				data-test-id="chat-search-close"
				class="fl-press bg-muted text-foreground grid size-11 min-w-[44px] shrink-0 place-items-center rounded-full"
			>
				<X size={18} aria-hidden="true" />
			</button>
		</div>
	{/if}

	{#if list.eventDate}
		<p
			class="text-label text-primary mt-3 flex items-center gap-2 rounded-md bg-[var(--fl-primary-tint)] px-4 py-2"
			data-test-id="event-date"
		>
			<CalendarDays size={17} aria-hidden="true" />
			{list.eventDate}
		</p>
	{/if}

	{#if messages.length === 0}
		<EmptyState
			illustration="chat"
			text={searchQuery.trim() ? t('chat.searchEmpty') : t('chat.empty')}
			testId={searchQuery.trim() ? 'chat-search-empty' : 'chat-empty'}
		/>
	{:else}
		<ol class="mt-6">
			{#each messages as message, index (message.id)}
				{@const previous = messages[index - 1]}
				{@const startsGroup =
					!previous ||
					previous.userId !== message.userId ||
					message.createdAt - previous.createdAt > GROUP_GAP_MS}
				{@const poll = data.pollOf(message.id)}
				{@const author = data.member(message.userId)}
				{@const mine = message.userId === data.me}

				<li
					class="flex flex-col {mine ? 'items-end' : 'items-start'} {index === 0 ? '' : startsGroup ? 'mt-4' : 'mt-1'}"
					data-test-class="chat-message"
				>
					{#if startsGroup}
						<p class="text-muted-foreground text-caption">
							{author?.name ?? t('chat.unknownAuthor')} — {time(message.createdAt)}
						</p>
					{/if}

					{#if message.body}
						<p
							class="text-product mt-1 max-w-[85%] rounded-md px-4 py-2
								{mine ? 'bg-[var(--fl-primary-tint)] text-primary' : 'bg-card border'}"
						>
							{message.body}
						</p>
					{/if}

					{#if message.photoPath}
						<ChatPhoto photoPath={message.photoPath} authorName={author?.name ?? t('chat.unknownAuthor')} />
					{/if}

					{#if poll}
						<div class="w-full">
							<PollCard {poll} {listId} />
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}

	{#if composing}
		<form onsubmit={createPoll} class="bg-card mt-6 space-y-4 rounded-xl border p-4" data-test-id="poll-form">
			<div>
				<Label for="poll-question">{t('chat.question')}</Label>
				<IconField icon={MessageCircleQuestionMark}>
					<Input
						id="poll-question"
						bind:value={question}
						data-test-id="poll-question"
						required
						placeholder={t('chat.questionPlaceholder')}
					/>
				</IconField>
			</div>

			<div>
				<Label for="poll-choices">{t('chat.choices')}</Label>
				<IconField icon={List} align="top">
					<textarea
						id="poll-choices"
						bind:value={choices}
						rows="4"
						placeholder={t('chat.choicesPlaceholder')}
						data-test-id="poll-choices"
						class="border-input bg-background w-full rounded-md border p-2"
					></textarea>
				</IconField>
			</div>

			{#if pollError}
				<p class="text-destructive text-caption" role="alert" data-test-id="poll-error">
					{t('chat.pollNoChoices')}
				</p>
			{/if}

			<div class="flex flex-wrap gap-2">
				<Button type="submit" data-test-id="poll-create">{t('chat.createPoll')}</Button>
				<Button type="button" variant="outline" onclick={() => (composing = null)}>
					{t('common.cancel')}
				</Button>
			</div>
		</form>
	{/if}

	<ChatPhotoPicker bind:this={photoPicker} scopeId={listId} onUploaded={sendPhoto} />

	<!--
		At rest, a compact field next to the single button that opens every other action: a date poll, the
		"who brings what" poll, asking the AI for a recipe, sending a photo. The three buttons this replaces
		said everything at once, all the time, for something typed a few times per list at most.

		The field grows to the full row on focus — typing a real message deserves the room, the compact
		width was only ever an at-rest state. `aria-label` and not only the placeholder: the latter is not an
		accessible name, and it disappears at the first letter typed.
	-->
	<form
		onsubmit={send}
		class="mt-4 flex items-center gap-2 pb-[env(safe-area-inset-bottom)]"
		data-test-id="chat-form"
	>
		<div class="min-w-0 flex-1">
			<Input
				bind:value={body}
				onfocus={() => (bodyFocused = true)}
				onblur={() => (bodyFocused = false)}
				aria-label={t('chat.messageLabel')}
				placeholder={t('chat.placeholder')}
				data-test-id="chat-input"
				class="transition-all duration-200 {bodyFocused ? '' : 'max-w-[14rem]'}"
				required
			/>
		</div>
		<Button type="submit" class="min-w-[44px] shrink-0" data-test-id="chat-send" aria-label={t('chat.send')}>
			<AnimatedIcon name="send" size={18} />
		</Button>
		<button
			type="button"
			onclick={() => {
				feedback.play('tap');
				composeSheet?.show();
			}}
			aria-haspopup="dialog"
			aria-label={t('chat.composeOpen')}
			data-test-id="chat-compose-open"
			class="fl-press bg-primary text-primary-foreground grid size-11 min-w-[44px] shrink-0 place-items-center rounded-full"
		>
			<Plus size={20} aria-hidden="true" />
		</button>
	</form>

	<ActionSheet bind:this={composeSheet} title={t('chat.composeOpen')} actions={composeActions} />
{/if}
