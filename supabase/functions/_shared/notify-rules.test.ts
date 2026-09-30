import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	decide,
	defaultSettings,
	groupRows,
	isQuiet,
	parseSettings,
	phrase,
	type OutboxRow,
	type QuietHours
} from './notify-rules';

const PARIS: QuietHours = { enabled: true, start: '22:00', end: '07:00', timezone: 'Europe/Paris' };

describe('isQuiet', () => {
	it('crosses midnight and follows the account’s timezone', () => {
		// 2026-01-15 22:30 Paris is 21:30 UTC.
		expect(isQuiet(new Date('2026-01-15T21:30:00Z'), PARIS)).toBe(true);
		expect(isQuiet(new Date('2026-01-15T05:59:00Z'), PARIS)).toBe(true); // 06:59 Paris
		expect(isQuiet(new Date('2026-01-15T06:00:00Z'), PARIS)).toBe(false); // 07:00 Paris
		expect(isQuiet(new Date('2026-01-15T12:00:00Z'), PARIS)).toBe(false);
	});

	it('handles a same-day window and a disabled one', () => {
		const lunch: QuietHours = { enabled: true, start: '12:00', end: '14:00', timezone: 'UTC' };
		expect(isQuiet(new Date('2026-01-15T13:00:00Z'), lunch)).toBe(true);
		expect(isQuiet(new Date('2026-01-15T14:00:00Z'), lunch)).toBe(false);
		expect(isQuiet(new Date('2026-01-15T23:00:00Z'), { ...PARIS, enabled: false })).toBe(false);
	});

	it('follows daylight saving time', () => {
		// Paris is UTC+2 in July: 22:30 local is 20:30 UTC.
		expect(isQuiet(new Date('2026-07-15T20:30:00Z'), PARIS)).toBe(true);
		expect(isQuiet(new Date('2026-07-15T19:30:00Z'), PARIS)).toBe(false);
	});
});

describe('parseSettings and decide', () => {
	it('falls back on defaults for anything malformed', () => {
		const settings = parseSettings({ types: { chat: 'yes' }, quiet: { start: '25:00', timezone: 'Mars/Base' }, mutedLists: [1, 'a'] });
		expect(settings.types.chat).toBe(true);
		expect(settings.quiet.start).toBe('22:00');
		expect(settings.quiet.timezone).toBe('UTC');
		expect(settings.mutedLists).toEqual(['a']);
	});

	it('says why a notification does not go', () => {
		const now = new Date('2026-01-15T12:00:00Z');
		const settings = { ...defaultSettings(), quiet: PARIS };

		expect(decide('chat', null, settings, now)).toBe('send');
		expect(decide('chat', null, { ...settings, types: { ...settings.types, chat: false } }, now)).toBe('off');
		expect(decide('chat', 'l1', { ...settings, mutedLists: ['l1'] }, now)).toBe('muted');
		expect(decide('chat', null, settings, new Date('2026-01-15T22:00:00Z'))).toBe('quiet');
	});
});

describe('groupRows', () => {
	const row = (over: Partial<OutboxRow>): OutboxRow => ({
		id: 'x',
		kind: 'chat',
		recipientId: 'u1',
		path: '/l/1/chat',
		groupKey: 'chat:1',
		listId: '1',
		title: 'Courses',
		body: 'hi',
		createdAt: '2026-01-01T10:00:00Z',
		...over
	});

	it('keeps the latest five chat lines, oldest first, in one push', () => {
		const rows = Array.from({ length: 7 }, (_, n) => row({ id: `m${n}`, body: `line ${n}`, createdAt: `2026-01-01T10:0${n}:00Z` }));
		const [push] = groupRows(rows, 'en');

		expect(groupRows(rows, 'en')).toHaveLength(1);
		expect(push.body.split('\n')).toEqual(['line 2', 'line 3', 'line 4', 'line 5', 'line 6']);
		expect(push.ids).toHaveLength(7);
	});

	it('counts list activity in the recipient’s language', () => {
		const rows = [1, 2, 3, 4].map(n => row({ id: `i${n}`, kind: 'list_activity', groupKey: 'list:1', body: 'Sedra', path: '/l/1', createdAt: `2026-01-01T10:0${n}:00Z` }));
		expect(groupRows(rows, 'fr')[0].body).toBe('Sedra a ajouté 4 article(s)');
	});

	it('separates recipients and conversations', () => {
		const rows = [row({ id: 'a' }), row({ id: 'b', recipientId: 'u2' }), row({ id: 'c', groupKey: 'chat:2' })];
		expect(groupRows(rows, 'en')).toHaveLength(3);
	});

	it('knows a phrase in every shipped language', () => {
		for (const locale of ['en', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'ar', 'zh', 'mg']) {
			expect(phrase(locale, 'joined', { name: 'Zoé' })).toContain('Zoé');
		}
		expect(phrase('xx', 'joined', { name: 'Zoé' })).toContain('joined');
	});
});

describe('the client copy', () => {
	it('is identical to the function’s', () => {
		const here = readFileSync(new URL('./notify-rules.ts', import.meta.url), 'utf8');
		const there = readFileSync(new URL('../../../src/lib/domain/notify-rules.ts', import.meta.url), 'utf8');
		expect(there).toBe(here);
	});
});
