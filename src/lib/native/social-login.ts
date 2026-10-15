import { Capacitor } from '@capacitor/core';
import {
	outcomeFromError,
	outcomeFromToken,
	type GoogleClientIds,
	type NativeFlow,
	type NativeOutcome
} from '$domain/native-sign-in';

/**
 * The system account pickers (#499): Google's on Android and iOS, Apple's on iOS. The plugin is loaded on
 * demand and only inside a native shell, so the web bundle never carries it, and the F-Droid build, which
 * ships without it, answers "unavailable" and falls back to the redirect.
 */
let initialised: Promise<void> | null = null;

async function load() {
	const { SocialLogin } = await import('@capgo/capacitor-social-login');
	return SocialLogin;
}

function initialise(google: GoogleClientIds): Promise<void> {
	initialised ??= load()
		.then((social) =>
			social.initialize({
				google: {
					webClientId: google.web ?? undefined,
					iOSClientId: google.ios ?? undefined,
					iOSServerClientId: google.web ?? undefined
				},
				apple: {}
			})
		)
		.then(() => undefined)
		.catch((error) => {
			initialised = null;
			throw error;
		});

	return initialised;
}

export async function nativeIdToken(flow: NativeFlow, google: GoogleClientIds): Promise<NativeOutcome> {
	if (!Capacitor.isNativePlatform()) return { status: 'unavailable' };

	try {
		await initialise(google);
		const social = await load();
		const { result } =
			flow === 'google'
				? await social.login({ provider: 'google', options: { scopes: ['email', 'profile'] } })
				: await social.login({ provider: 'apple', options: { scopes: ['email', 'name'] } });

		return outcomeFromToken('idToken' in result ? result.idToken : null);
	} catch (error) {
		return outcomeFromError(error);
	}
}
