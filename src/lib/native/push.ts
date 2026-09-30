import { Capacitor } from '@capacitor/core';
import { supabase } from '$db/supabase';

/**
 * Push notifications through Firebase Cloud Messaging, on the Android and iOS builds.
 *
 * What was a deliberate absence (see `reminders.ts`) is now an Edge Function (`notify`) fed by triggers; this
 * file is the device's half: ask for the permission on a gesture, hand the token to the account, open the
 * right screen when a notification is tapped. On the web there is no push, and the F-Droid build has no FCM:
 * `pushSupported()` is false there and everything below does nothing, local reminders keep working.
 */
export type PushPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

const DEVICE_KEY = 'familist:push-device';

export function pushSupported(): boolean {
	return Capacitor.isNativePlatform();
}

function deviceId(): string {
	try {
		const known = localStorage.getItem(DEVICE_KEY);
		if (known) return known;
		const created = crypto.randomUUID();
		localStorage.setItem(DEVICE_KEY, created);
		return created;
	} catch {
		return 'unknown';
	}
}

/** The channels users tune in the system settings: one per kind of notification. */
const CHANNELS = [
	{ id: 'chats', nameKey: 'chats' },
	{ id: 'lists', nameKey: 'lists' },
	{ id: 'invitations', nameKey: 'invitations' },
	{ id: 'reminders', nameKey: 'reminders' },
	{ id: 'timers', nameKey: 'timers' }
] as const;

export async function pushPermission(): Promise<PushPermission> {
	if (!pushSupported()) return 'unsupported';
	try {
		const { PushNotifications } = await import('@capacitor/push-notifications');
		const { receive } = await PushNotifications.checkPermissions();
		return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt';
	} catch {
		return 'unsupported';
	}
}

/** Asking, only on a gesture: a refusal is final after twice on Android 13. */
export async function requestPushPermission(): Promise<PushPermission> {
	if (!pushSupported()) return 'unsupported';
	try {
		const { PushNotifications } = await import('@capacitor/push-notifications');
		const { receive } = await PushNotifications.requestPermissions();
		return receive === 'granted' ? 'granted' : 'denied';
	} catch {
		return 'unsupported';
	}
}

let listening = false;

/**
 * Registers this device for the signed-in account, when the permission is already granted. Safe to call on
 * every launch: it never asks, it only refreshes the token the system may have rotated.
 */
export async function registerPush(
	userId: string,
	open: (path: string) => void,
	channelName: (id: string) => string
): Promise<void> {
	if ((await pushPermission()) !== 'granted') return;

	try {
		const { PushNotifications } = await import('@capacitor/push-notifications');

		if (!listening) {
			listening = true;

			await PushNotifications.addListener('registration', async ({ value }) => {
				await supabase.from('push_tokens').upsert({
					user_id: userId,
					device_id: deviceId(),
					platform: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android',
					token: value,
					updated_at: new Date().toISOString()
				});
			});

			await PushNotifications.addListener('pushNotificationActionPerformed', action => {
				const path = action.notification.data?.path;
				if (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')) open(path);
			});
		}

		if (Capacitor.getPlatform() === 'android') {
			for (const channel of CHANNELS) {
				await PushNotifications.createChannel({
					id: channel.id,
					name: channelName(channel.nameKey),
					importance: channel.id === 'timers' ? 5 : 4
				});
			}
		}

		await PushNotifications.register();
	} catch {
		// Push is a convenience: a failure here leaves the app working without it.
	}
}

/** On sign-out the device stops receiving this account's notifications. */
export async function unregisterPush(userId: string): Promise<void> {
	await supabase.from('push_tokens').delete().match({ user_id: userId, device_id: deviceId() });

	if (!pushSupported()) return;
	try {
		const { PushNotifications } = await import('@capacitor/push-notifications');
		await PushNotifications.unregister();
	} catch {
		// Nothing to undo.
	}
}

/** A local notification to check the whole path on this device without waiting for a real event. */
export async function sendTestNotification(title: string, body: string): Promise<boolean> {
	if (!pushSupported()) return false;
	try {
		const { LocalNotifications } = await import('@capacitor/local-notifications');
		const current = await LocalNotifications.checkPermissions();
		if (current.display !== 'granted') {
			const requested = await LocalNotifications.requestPermissions();
			if (requested.display !== 'granted') return false;
		}

		await LocalNotifications.schedule({
			notifications: [{ id: 2_000_000_001, title, body, schedule: { at: new Date(Date.now() + 1000) } }]
		});
		return true;
	} catch {
		return false;
	}
}
