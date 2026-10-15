import type { Platform, ProviderId } from './oauth';

/**
 * Whether the system account picker can be used for a provider, or the web redirect must.
 *
 * Only Google on Android and iOS, and Apple on iOS, have a native flow. Everything else, and every
 * platform where the identifiers are missing, takes the redirect: a native call that cannot work would
 * only add a failure before the fallback.
 */
export interface GoogleClientIds {
	web: string | null;
	ios: string | null;
}

export type NativeFlow = 'google' | 'apple';

export function nativeFlowFor(id: ProviderId, platform: Platform, google: GoogleClientIds): NativeFlow | null {
	if (id === 'apple') return platform === 'ios' ? 'apple' : null;
	if (id !== 'google') return null;
	if (platform === 'android') return google.web ? 'google' : null;
	if (platform === 'ios') return google.ios && google.web ? 'google' : null;
	return null;
}

/** What the picker gave back: an ID token to exchange, the person closing it, or nothing usable. */
export type NativeOutcome =
	| { status: 'token'; token: string }
	| { status: 'cancelled' }
	| { status: 'unavailable' };

const CANCELLATION = /cancel|dismiss|abort|1001|12501/i;

/**
 * A closed picker is the person's answer, not a failure: sending them on to the browser right after they
 * said no would be rude. Any other error means the native route is broken here and the redirect takes over.
 */
export function outcomeFromError(error: unknown): NativeOutcome {
	const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
	const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
	return CANCELLATION.test(`${message} ${code}`) ? { status: 'cancelled' } : { status: 'unavailable' };
}

export function outcomeFromToken(token: unknown): NativeOutcome {
	return typeof token === 'string' && token !== '' ? { status: 'token', token } : { status: 'unavailable' };
}
