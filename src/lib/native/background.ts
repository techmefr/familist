import { Capacitor } from '@capacitor/core';
import type { Notice } from '$domain/background-notice';

/**
 * Staying connected in the background, on Android, without Google services (#487's sibling).
 *
 * The app already keeps a live connection to the server while it is open. A foreground service lets Android
 * keep that connection, and the app, alive once it leaves the screen; whatever arrives then is turned into a
 * local notification by `noticeFor`. No push service is involved at all — nothing but the person's own
 * Supabase. The price is one permanent notice in the status bar (Android requires it) and some battery.
 * On other platforms there is nothing to start.
 */
const KEY = 'familist:background-listening';
const SERVICE_ID = 4101;
const SMALL_ICON = 'ic_stat_familiste';

export function backgroundSupported(): boolean {
	return Capacitor.getPlatform() === 'android';
}

export function isBackgroundEnabled(): boolean {
	try {
		return localStorage.getItem(KEY) === '1';
	} catch {
		return false;
	}
}

export function rememberBackground(isOn: boolean): void {
	try {
		localStorage.setItem(KEY, isOn ? '1' : '0');
	} catch {
		// A blocked storage only means the choice is asked again next time.
	}
}

export async function startBackground(title: string, body: string): Promise<boolean> {
	if (!backgroundSupported()) return false;

	try {
		const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
		await ForegroundService.startForegroundService({ id: SERVICE_ID, title, body, smallIcon: SMALL_ICON, silent: true });
		return true;
	} catch {
		return false;
	}
}

export async function stopBackground(): Promise<void> {
	if (!backgroundSupported()) return;

	try {
		const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
		await ForegroundService.stopForegroundService();
	} catch {
		// Already stopped, or the plugin is absent from this build.
	}
}

const CHANNEL_OF: Record<Notice['kind'], string> = { chat: 'chats', list_activity: 'lists' };

let isListening = false;

/** Channels the person can tune in the system settings, and the tap that opens the right screen. */
export async function prepareNotices(open: (path: string) => void, channelName: (id: string) => string): Promise<void> {
	if (!backgroundSupported() || isListening) return;
	isListening = true;

	try {
		const { LocalNotifications } = await import('@capacitor/local-notifications');

		for (const id of ['chats', 'lists']) {
			await LocalNotifications.createChannel({ id, name: channelName(id), importance: 4 });
		}

		await LocalNotifications.addListener('localNotificationActionPerformed', action => {
			const path = (action.notification.extra as { path?: unknown } | undefined)?.path;
			if (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')) open(path);
		});
	} catch {
		isListening = false;
	}
}

export async function showNotice(notice: Notice): Promise<void> {
	try {
		const { LocalNotifications } = await import('@capacitor/local-notifications');
		const permission = await LocalNotifications.checkPermissions();
		if (permission.display !== 'granted') return;

		await LocalNotifications.schedule({
			notifications: [
				{
					// One slot per conversation or list: a newer message replaces the previous one instead of stacking.
					id: slot(notice.groupKey),
					title: notice.name,
					body: notice.body,
					channelId: CHANNEL_OF[notice.kind],
					extra: { path: notice.path, kind: 'background' },
					schedule: { at: new Date(Date.now() + 250), allowWhileIdle: true }
				}
			]
		});
	} catch {
		// A notification that could not be shown is not worth breaking the live connection for.
	}
}

/** A stable positive integer for a group, in a range of its own apart from the reminders' and the timers'. */
function slot(groupKey: string): number {
	let hash = 7;
	for (const character of groupKey) hash = (hash * 33 + character.charCodeAt(0)) | 0;
	return 1_500_000_000 + (Math.abs(hash) % 400_000_000);
}
