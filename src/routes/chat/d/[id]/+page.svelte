<script lang="ts">
	import { unread } from '$stores/unread.svelte';
	import { page } from '$app/state';
	import { data } from '$stores/data.svelte';
	import { t, i18n } from '$i18n/index.svelte';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { ArrowLeft, ImagePlus, Send } from '@lucide/svelte';
	import Avatar from '$components/app/Avatar.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';
	import AiRecipeEntry from '$components/app/AiRecipeEntry.svelte';
	import ChatPhoto from '$components/app/ChatPhoto.svelte';
	import ChatPhotoPicker from '$components/app/ChatPhotoPicker.svelte';

	const conversationId = $derived(page.params.id!);
	const conversation = $derived(data.direct(conversationId));
	const other = $derived(data.otherOf(conversationId));
	const messages = $derived(data.messagesOfConversation(conversationId));

	/** Open and kept open: whatever arrives while this screen is showing is read as it lands. */
	$effect(() => {
		void messages.length;
		unread.markRead(conversationId);
	});

	let body = $state('');
	let photoPicker = $state<ChatPhotoPicker | null>(null);

	async function send(event: SubmitEvent) {
		event.preventDefault();
		if (!body.trim()) return;

		const sending = data.sendDirectMessage(conversationId, body);
		body = '';
		await sending;
	}

	/** Same connectivity requirement as the list chat: see the note on ChatPhotoPicker (#366). */
	async function sendPhoto(photoPath: string) {
		await data.sendDirectMessage(conversationId, '', photoPath);
	}

	const time = (at: number) =>
		new Intl.DateTimeFormat(i18n.locale, { timeStyle: 'short' }).format(new Date(at));

	const otherName = $derived(other?.name ?? t('chat.someone'));
</script>

<svelte:head>
	<title>{otherName} — {t('app.name')}</title>
</svelte:head>

{#if !data.ready}
	<p class="text-muted-foreground">{t('common.loading')}</p>
{:else if !conversation}
	<p class="text-muted-foreground">{t('chat.directNotFound')}</p>
	<a href="/chat" class="text-primary mt-4 inline-block underline">{t('chat.backToChats')}</a>
{:else}
	<a
		href="/chat"
		class="text-muted-foreground text-label inline-flex min-h-[max(2.75rem,44px)] items-center gap-2"
	>
		<ArrowLeft size={16} aria-hidden="true" />
		{t('chat.backToChats')}
	</a>

	<h1 class="text-h1 mt-2 flex items-center gap-3 font-semibold">
		{#if other}
			<Avatar member={other} size={36} />
		{/if}
		{otherName}
	</h1>

	<p class="text-caption text-muted-foreground mt-2">{t('chat.directsHint')}</p>

	{#if messages.length === 0}
		<EmptyState illustration="chat" text={t('chat.empty')} testId="direct-empty" />
	{:else}
		<ol class="mt-6 space-y-4">
			{#each messages as message (message.id)}
				{@const mine = message.userId === data.me}

				<li
					class="flex flex-col {mine ? 'items-end' : 'items-start'}"
					data-test-class="direct-message"
				>
					<p class="text-muted-foreground text-caption">
						{mine ? t('household.role.self') : otherName} — {time(message.createdAt)}
					</p>

					{#if message.body}
						<p
							class="text-product mt-1 max-w-[85%] rounded-md px-4 py-2
								{mine ? 'bg-[var(--fl-primary-tint)] text-primary' : 'bg-card border'}"
						>
							{message.body}
						</p>
					{/if}

					{#if message.photoPath}
						<ChatPhoto photoPath={message.photoPath} authorName={mine ? t('household.role.self') : otherName} />
					{/if}
				</li>
			{/each}
		</ol>
	{/if}

	<!-- Only appears if an AI key is set in the settings; otherwise, nothing at all. -->
	<div class="mt-6">
		<AiRecipeEntry />
	</div>

	<form onsubmit={send} class="mt-4 flex items-center gap-2" data-test-id="direct-form">
		<Input
			bind:value={body}
			aria-label={t('chat.messageLabel')}
			placeholder={t('chat.placeholder')}
			data-test-id="direct-input"
			required
		/>
		<Button
			type="submit"
			class="min-w-[44px] shrink-0"
			data-test-id="direct-send"
			aria-label={t('chat.send')}
		>
			<Send size={18} aria-hidden="true" />
		</Button>
		<button
			type="button"
			onclick={() => photoPicker?.show()}
			aria-label={t('chat.composePhoto')}
			data-test-id="direct-photo-open"
			class="fl-press bg-muted text-foreground grid size-11 min-w-[44px] shrink-0 place-items-center rounded-full"
		>
			<ImagePlus size={18} aria-hidden="true" />
		</button>
	</form>

	<ChatPhotoPicker bind:this={photoPicker} scopeId={conversationId} onUploaded={sendPhoto} />
{/if}
