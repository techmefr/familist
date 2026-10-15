import { describe, expect, it } from 'vitest';
import { nativeFlowFor, outcomeFromError, outcomeFromToken } from './native-sign-in';

const none = { web: null, ios: null };
const both = { web: 'web.apps.googleusercontent.com', ios: 'ios.apps.googleusercontent.com' };

describe('nativeFlowFor', () => {
	it('uses the Google picker on Android once the web client id is set', () => {
		expect(nativeFlowFor('google', 'android', { web: both.web, ios: null })).toBe('google');
		expect(nativeFlowFor('google', 'android', none)).toBeNull();
	});

	it('needs both Google client ids on iOS', () => {
		expect(nativeFlowFor('google', 'ios', both)).toBe('google');
		expect(nativeFlowFor('google', 'ios', { web: both.web, ios: null })).toBeNull();
	});

	it('uses Sign in with Apple on iOS only, with no identifier to configure', () => {
		expect(nativeFlowFor('apple', 'ios', none)).toBe('apple');
		expect(nativeFlowFor('apple', 'android', none)).toBeNull();
	});

	it('never goes native on the web or for another provider', () => {
		expect(nativeFlowFor('google', 'web', both)).toBeNull();
		expect(nativeFlowFor('github', 'android', both)).toBeNull();
	});
});

describe('native outcomes', () => {
	it('reads a token', () => {
		expect(outcomeFromToken('jwt')).toEqual({ status: 'token', token: 'jwt' });
	});

	it('treats a missing or empty token as unavailable', () => {
		expect(outcomeFromToken(null)).toEqual({ status: 'unavailable' });
		expect(outcomeFromToken('')).toEqual({ status: 'unavailable' });
	});

	it('tells a closed picker from a broken one', () => {
		expect(outcomeFromError(new Error('User cancelled the sign-in'))).toEqual({ status: 'cancelled' });
		expect(outcomeFromError({ code: '1001' })).toEqual({ status: 'cancelled' });
		expect(outcomeFromError(new Error('Plugin not implemented'))).toEqual({ status: 'unavailable' });
		expect(outcomeFromError(undefined)).toEqual({ status: 'unavailable' });
	});
});
