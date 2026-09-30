import { describe, expect, it } from 'vitest';
import { buildMessage, isDeadToken } from './fcm';

describe('buildMessage', () => {
	it('carries a title, a body and a path, on the channel of its kind', () => {
		const { message } = buildMessage({ token: 't', title: 'Courses', body: 'hi', path: '/l/1/chat', kind: 'list_activity', tag: 'list:1' });

		expect(message.notification).toEqual({ title: 'Courses', body: 'hi' });
		expect(message.data).toEqual({ path: '/l/1/chat' });
		expect(message.android.notification.channel_id).toBe('lists');
		expect(Object.keys(message).sort()).toEqual(['android', 'data', 'notification', 'token']);
	});

	it('puts invitations and requests on their own channel', () => {
		expect(buildMessage({ token: 't', title: '', body: '', path: '/', kind: 'invite', tag: 'x' }).message.android.notification.channel_id).toBe('invitations');
		expect(buildMessage({ token: 't', title: '', body: '', path: '/', kind: 'unknown', tag: 'x' }).message.android.notification.channel_id).toBe('chats');
	});
});

describe('isDeadToken', () => {
	it('drops unregistered and invalid tokens only', () => {
		expect(isDeadToken(404, '{"error":{"status":"NOT_FOUND"}}')).toBe(true);
		expect(isDeadToken(400, '{"error":{"status":"INVALID_ARGUMENT","message":"The registration token is not a valid FCM registration token"}}')).toBe(true);
		expect(isDeadToken(400, '{"error":{"message":"bad payload field"}}')).toBe(false);
		expect(isDeadToken(500, 'boom')).toBe(false);
		expect(isDeadToken(429, 'quota')).toBe(false);
	});
});
