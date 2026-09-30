import { describe, expect, it } from 'vitest';
import { badgeText, unreadIds } from './unread';

const tip = (id: string, lastAt: number, lastAuthorId: string | null) => ({ id, lastAt, lastAuthorId });

describe('unreadIds', () => {
	it('flags a conversation whose latest message is newer and not mine', () => {
		expect(unreadIds([tip('a', 100, 'u2'), tip('b', 50, 'u2')], { a: 10, b: 50 }, 'u1')).toEqual(['a']);
	});

	it('never counts my own last message, an empty chat or a never-opened one with nothing', () => {
		expect(unreadIds([tip('a', 100, 'u1'), tip('b', 0, null)], {}, 'u1')).toEqual([]);
	});

	it('counts a conversation never opened that has a message from someone else', () => {
		expect(unreadIds([tip('a', 100, 'u2')], {}, 'u1')).toEqual(['a']);
	});
});

describe('badgeText', () => {
	it('is empty at zero and caps at 9+', () => {
		expect(badgeText(0)).toBe('');
		expect(badgeText(3)).toBe('3');
		expect(badgeText(10)).toBe('9+');
	});
});
