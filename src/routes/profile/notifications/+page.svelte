<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { session } from '$stores/session.svelte';
	import { settings } from '$stores/settings.svelte';
	import { data } from '$stores/data.svelte';
	import { t } from '$i18n/index.svelte';
	import { categoryById } from '$domain/settings-categories';
	import type { NotificationType } from '$domain/notify-rules';
	import {
		pushPermission,
		registerPush,
		requestPushPermission,
		loadNtfyTopic,
		saveNtfyTopic,
		sendTestNotification,
		type PushPermission
	} from '$native/push';
	import { highlightSettingTarget } from '$components/app/setting-target';
	import * as Card from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Switch } from '$components/ui/switch';
	import { goto } from '$app/navigation';

	const category = categoryById('notifications');

	afterNavigate(({ to }) => highlightSettingTarget(to?.url));

	/** What the person sees as one switch can cover two kinds on the server. */
	const GROUPS: { id: string; types: NotificationType[] }[] = [
		{ id: 'chats', types: ['chat', 'poll'] },
		{ id: 'lists', types: ['list_activity'] },
		{ id: 'invitations', types: ['invite', 'card_request'] },
		{ id: 'reminders', types: ['reminder'] },
		{ id: 'timers', types: ['timer'] }
	];

	let permission = $state<PushPermission>('unsupported');
	let testSent = $state<boolean | null>(null);

	let ntfyTopic = $state('');
	let ntfyStatus = $state<'saved' | 'removed' | 'invalid' | 'failed' | null>(null);

	onMount(async () => {
		permission = await pushPermission();
		const id = session.user?.id;
		if (id) ntfyTopic = await loadNtfyTopic(id);
	});

	async function saveNtfy() {
		const id = session.user?.id;
		if (id) ntfyStatus = await saveNtfyTopic(id, ntfyTopic);
	}

	async function enable() {
		permission = await requestPushPermission();
		const id = session.user?.id;
		if (permission === 'granted' && id) {
			await registerPush(id, path => void goto(path), key => t(`notifications.channels.${key}`));
		}
	}

	async function test() {
		testSent = await sendTestNotification(t('notifications.testTitle'), t('notifications.testBody'));
	}

	const isOn = (types: NotificationType[]) => types.every(type => settings.notifications.types[type]);
	const setGroup = (types: NotificationType[], on: boolean) => {
		for (const type of types) settings.setNotificationType(type, on);
	};
</script>

<svelte:head>
	<title>{t(category.title)} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t(category.title)}</h1>

<Card.Root class="mt-6">
	<Card.Content class="fl-divided">
		<div class="fl-setting" id="setting-ntfy" data-test-id="notifications-ntfy">
			<Label for="ntfy-topic" class="text-label font-medium">{t('notifications.ntfyTitle')}</Label>
			<p class="text-muted-foreground text-caption mt-1">{t('notifications.ntfyHint')}</p>
			<div class="mt-2 flex flex-wrap gap-2">
				<Input
					id="ntfy-topic"
					type="url"
					bind:value={ntfyTopic}
					placeholder="https://ntfy.sh/familiste-xxxxxxxx"
					autocomplete="off"
					class="min-w-0 flex-1"
					data-test-id="ntfy-topic"
				/>
				<Button variant="outline" onclick={saveNtfy} data-test-id="ntfy-save">{t('common.save')}</Button>
			</div>
			{#if ntfyStatus}
				<p class="text-caption mt-2" role="status" data-test-id="ntfy-status">{t(`notifications.ntfy.${ntfyStatus}`)}</p>
			{/if}
		</div>

		<div class="fl-setting" data-test-id="notifications-permission">
			<p class="text-label font-medium">{t('notifications.permissionTitle')}</p>

			{#if permission === 'unsupported'}
				<p class="text-muted-foreground text-label mt-1" data-test-id="notifications-unsupported">
					{t('notifications.unsupported')}
				</p>
			{:else if permission === 'granted'}
				<p class="text-label mt-1" data-test-id="notifications-granted">{t('notifications.granted')}</p>
				<Button variant="outline" onclick={test} class="mt-3" data-test-id="notifications-test">
					{t('notifications.test')}
				</Button>
				{#if testSent === false}
					<p class="text-destructive text-caption mt-2" role="alert">{t('notifications.denied')}</p>
				{/if}
			{:else if permission === 'denied'}
				<p class="text-label mt-1" role="alert" data-test-id="notifications-denied">
					{t('notifications.denied')}
				</p>
			{:else}
				<Button onclick={enable} class="mt-3" data-test-id="notifications-enable">
					{t('notifications.enable')}
				</Button>
			{/if}
		</div>

		<fieldset id="setting-notification-types" tabindex="-1" class="fl-setting">
			<legend class="text-label mb-2 font-medium">{t('notifications.typesTitle')}</legend>
			{#each GROUPS as group (group.id)}
				<div class="flex min-h-11 items-center justify-between gap-3">
					<Label for="notify-{group.id}">{t(`notifications.type.${group.id}`)}</Label>
					<Switch
						id="notify-{group.id}"
						size="lg"
						checked={isOn(group.types)}
						onCheckedChange={checked => setGroup(group.types, checked)}
						data-test-id="notify-{group.id}"
					/>
				</div>
			{/each}
		</fieldset>

		<fieldset id="setting-notification-lists" tabindex="-1" class="fl-setting">
			<legend class="text-label mb-2 font-medium">{t('notifications.listsTitle')}</legend>
			{#if data.lists.length === 0}
				<p class="text-muted-foreground text-label">{t('notifications.listsEmpty')}</p>
			{:else}
				{#each data.lists as list (list.id)}
					<div class="flex min-h-11 items-center justify-between gap-3">
						<Label for="mute-{list.id}" class="min-w-0 truncate">{list.emoji} {list.name}</Label>
						<Switch
							id="mute-{list.id}"
							size="lg"
							aria-label={t('notifications.muteList', { name: list.name })}
							checked={settings.notifications.mutedLists.includes(list.id)}
							onCheckedChange={checked => settings.setListMuted(list.id, checked)}
							data-test-id="mute-{list.id}"
						/>
					</div>
				{/each}
			{/if}
		</fieldset>

		<fieldset id="setting-quiet-hours" tabindex="-1" class="fl-setting">
			<legend class="text-label mb-2 font-medium">{t('notifications.quietTitle')}</legend>
			<div class="flex min-h-11 items-center justify-between gap-3">
				<Label for="quiet-enabled">{t('notifications.quietEnabled')}</Label>
				<Switch
					id="quiet-enabled"
					size="lg"
					checked={settings.notifications.quiet.enabled}
					onCheckedChange={checked => settings.setQuietHours({ enabled: checked })}
					data-test-id="quiet-enabled"
				/>
			</div>
			<div class="mt-3 flex flex-wrap gap-4">
				<div class="min-w-0 flex-1">
					<Label for="quiet-start">{t('notifications.quietStart')}</Label>
					<Input
						id="quiet-start"
						type="time"
						value={settings.notifications.quiet.start}
						onchange={event => settings.setQuietHours({ start: event.currentTarget.value })}
						class="w-full min-w-0"
						data-test-id="quiet-start"
					/>
				</div>
				<div class="min-w-0 flex-1">
					<Label for="quiet-end">{t('notifications.quietEnd')}</Label>
					<Input
						id="quiet-end"
						type="time"
						value={settings.notifications.quiet.end}
						onchange={event => settings.setQuietHours({ end: event.currentTarget.value })}
						class="w-full min-w-0"
						data-test-id="quiet-end"
					/>
				</div>
			</div>
			<p class="text-muted-foreground text-caption mt-2">
				{t('notifications.quietHint')} ({settings.notifications.quiet.timezone})
			</p>
		</fieldset>
	</Card.Content>
</Card.Root>
