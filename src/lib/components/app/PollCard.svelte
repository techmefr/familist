<script lang="ts">
	import type { Poll } from '$db/schema';
	import { data } from '$stores/data.svelte';
	import { t } from '$i18n/index.svelte';
	import { Button } from '$components/ui/button';
	import { Check, CalendarCheck, ListPlus, Pencil, X } from '@lucide/svelte';

	let { poll, listId }: { poll: Poll; listId: string } = $props();

	const options = $derived(data.optionsOf(poll.id));
	const totalVotes = $derived(options.reduce((sum, o) => sum + data.votersOf(o.id).length, 0));

	let editing = $state<string | null>(null);
	let draft = $state('');
	let pushed = $state<string | null>(null);
	let sheet = $state<HTMLDialogElement | null>(null);

	const editedOption = $derived(options.find(option => option.id === editing) ?? null);

	function openIngredients(optionId: string, ingredients: string[]) {
		editing = optionId;
		draft = ingredients.join('\n');
		sheet?.showModal();
	}

	function saveIngredients(optionId: string) {
		data.setIngredients(optionId, draft.split('\n'));
		sheet?.close();
	}

	function push(optionId: string) {
		const added = data.pushIngredients(listId, optionId);
		pushed = t('chat.pushed', { count: added });
		sheet?.close();
	}
</script>

<div class="bg-card mt-2 rounded-xl border p-4" data-test-class="poll-card">
	<p class="text-product font-medium">{poll.question}</p>

	<ul class="mt-3 space-y-2">
		{#each options as option (option.id)}
			{@const voters = data.votersOf(option.id)}
			{@const mine = voters.includes(data.me)}
			{@const share = totalVotes === 0 ? 0 : Math.round((voters.length / totalVotes) * 100)}
			{@const owner = option.claimedBy ? data.member(option.claimedBy) : undefined}

			<li>
				{#if poll.kind === 'date'}
					<button
						type="button"
						onclick={() => data.toggleVote(poll.id, option.id)}
						data-test-class="poll-vote"
						class="border-input relative w-full overflow-hidden rounded-md border px-3 py-3 text-start
							{mine ? 'border-primary' : ''}"
						aria-pressed={mine}
					>
						<span
							class="absolute inset-y-0 start-0 bg-[var(--fl-primary-tint)]"
							style="width: {share}%"
							aria-hidden="true"
						></span>
						<span class="relative flex items-center gap-2">
							{#if mine}
								<Check size={16} class="text-primary shrink-0" aria-hidden="true" />
							{/if}
							<span class="flex-1">{option.label}</span>
							<span class="text-muted-foreground text-caption">
								{t('chat.votes', { count: voters.length })}
							</span>
						</span>
					</button>
				{:else}
					<!--
						One line per dish: emoji, label, and a single chip that does the one thing you can do here
						(claim it, or give it back). Who has it is written out, never left to a colour. The ingredients
						open in a sheet, so a row never grows a cluster of buttons.
					-->
					<div
						class="border-input flex min-h-[max(2.75rem,44px)] items-center gap-2 rounded-md border px-3 py-1.5 {owner
							? 'border-primary'
							: ''}"
					>
						<span aria-hidden="true">{option.emoji ?? '🍽️'}</span>
						<span class="min-w-0 flex-1 truncate font-medium">{option.label}</span>

						{#if option.claimedBy && option.claimedBy !== data.me}
							<span class="text-caption text-primary shrink-0">{owner?.name ?? t('chat.someone')}</span>
						{:else}
							<Button
								variant={option.claimedBy ? 'outline' : 'default'}
								onclick={() => data.toggleClaim(option.id)}
								data-test-class="poll-claim"
								class="min-h-[max(2.75rem,44px)] shrink-0"
							>
								{option.claimedBy ? t('chat.release') : t('chat.claim')}
							</Button>
						{/if}
					</div>

					{#if option.claimedBy === data.me}
						<button
							type="button"
							onclick={() => openIngredients(option.id, option.ingredients)}
							data-test-class="poll-ingredients-edit"
							class="fl-press text-primary text-caption mt-1 inline-flex min-h-[max(2.75rem,44px)] items-center gap-1 px-2 font-medium"
						>
							<Pencil size={14} aria-hidden="true" />
							{t('chat.ingredients')}
							{#if option.ingredients.length > 0}({option.ingredients.length}){/if}
						</button>
					{/if}
				{/if}
			</li>
		{/each}
	</ul>

	{#if poll.kind === 'date'}
		{@const winner = options.reduce(
			(best, option) =>
				data.votersOf(option.id).length > data.votersOf(best.id).length ? option : best,
			options[0]
		)}
		{#if winner && totalVotes > 0}
			<Button
				onclick={() => data.setEventDate(listId, winner.label)}
				data-test-class="poll-set-date"
				class="mt-3"
			>
				<CalendarCheck size={16} aria-hidden="true" />
				{t('chat.setEventDate', { date: winner.label })}
			</Button>
		{/if}
	{/if}

	<dialog
		bind:this={sheet}
		onclick={event => {
			if (event.target === sheet) sheet?.close();
		}}
		onclose={() => (editing = null)}
		aria-label={t('chat.ingredients')}
		data-test-class="poll-ingredients-sheet"
		class="m-auto w-[min(32rem,calc(100%-2rem))] max-w-full rounded-2xl border bg-transparent p-0 backdrop:bg-[var(--fl-scrim)]"
	>
		{#if editedOption}
			<div class="bg-card relative rounded-2xl p-4">
				<h3 class="text-label pe-12 font-semibold">{editedOption.label}</h3>
				<textarea
					bind:value={draft}
					rows="5"
					placeholder={t('chat.ingredientsPlaceholder')}
					aria-label={t('chat.ingredients')}
					data-test-class="poll-ingredients"
					class="border-input bg-background mt-3 w-full rounded-md border p-2"
				></textarea>
				<div class="mt-3 flex flex-wrap gap-2">
					<Button onclick={() => saveIngredients(editedOption.id)} data-test-class="poll-ingredients-save">
						{t('common.save')}
					</Button>
					{#if editedOption.ingredients.length > 0}
						<Button variant="outline" onclick={() => push(editedOption.id)} data-test-class="poll-push">
							<ListPlus size={16} aria-hidden="true" />
							{t('chat.pushToList')}
						</Button>
					{/if}
				</div>
				<button
					type="button"
					onclick={() => sheet?.close()}
					aria-label={t('common.close')}
					class="fl-press text-muted-foreground absolute end-2 top-2 grid size-11 place-items-center rounded-full"
				>
					<X size={20} aria-hidden="true" />
				</button>
			</div>
		{/if}
	</dialog>

	{#if pushed}
		<p class="text-primary text-caption mt-3" role="status" data-test-class="poll-pushed">{pushed}</p>
	{/if}
</div>
