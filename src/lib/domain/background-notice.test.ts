import { describe, expect, it } from 'vitest';
import { defaultSettings } from './notify-rules';
import { LIST_ACTIVITY_GAP_MS, noticeFor, type Context } from './background-notice';

const context = (over: Partial<Context> = {}): Context => ({
	me: 'me',
	isHidden: true,
	now: new Date('2026-01-15T12:00:00Z'),
	settings: { ...defaultSettings(), quiet: { enabled: false, start: '22:00', end: '07:00', timezone: 'UTC' } },
	listName: () => 'Courses',
	memberName: () => 'Sedra',
	lastSent: new Map(),
	...over
});

const message = (over = {}) => ({
	table: 'messages' as const,
	listId: 'l1',
	conversationId: null,
	authorId: 'u2',
	isSystem: false,
	body: 'du lait ?',
	...over
});

describe('noticeFor', () => {
	it('announces a list message with its sender, and opens that chat', () => {
		expect(noticeFor(message(), context())).toMatchObject({ kind: 'chat', path: '/l/l1/chat', name: 'Courses', body: 'Sedra: du lait ?' });
	});

	it('announces a private message under the sender’s name', () => {
		const notice = noticeFor(message({ listId: null, conversationId: 'c1' }), context());
		expect(notice).toMatchObject({ path: '/chat/d/c1', name: 'Sedra', body: 'du lait ?' });
	});

	it('stays silent for what the screen already shows, for me and for system lines', () => {
		expect(noticeFor(message(), context({ isHidden: false }))).toBeNull();
		expect(noticeFor(message({ authorId: 'me' }), context())).toBeNull();
		expect(noticeFor(message({ isSystem: true }), context())).toBeNull();
		expect(noticeFor(message({ body: '  ' }), context())).toBeNull();
	});

	it('follows the account’s switches, muted lists and quiet hours', () => {
		const base = context();
		expect(noticeFor(message(), { ...base, settings: { ...base.settings, types: { ...base.settings.types, chat: false } } })).toBeNull();
		expect(noticeFor(message(), { ...base, settings: { ...base.settings, mutedLists: ['l1'] } })).toBeNull();
		expect(noticeFor(message(), { ...base, settings: { ...base.settings, quiet: { ...base.settings.quiet, enabled: true, start: '11:00', end: '13:00' } } })).toBeNull();
	});

	it('debounces list activity to one notice per list per two minutes', () => {
		const item = { table: 'items' as const, listId: 'l1', name: 'Lait' };
		const now = new Date('2026-01-15T12:00:00Z');

		expect(noticeFor(item, context())).toMatchObject({ kind: 'list_activity', path: '/l/l1', body: 'Lait' });
		expect(noticeFor(item, context({ lastSent: new Map([['list:l1', now.getTime() - 30_000]]) }))).toBeNull();
		expect(noticeFor(item, context({ lastSent: new Map([['list:l1', now.getTime() - LIST_ACTIVITY_GAP_MS - 1]]) }))).not.toBeNull();
	});
});
