import { browser } from '$app/environment';
import { data } from '$stores/data.svelte';
import { unreadIds, type ConversationTip, type LastRead } from '$domain/unread';

const KEY = 'familist:last-read';

function load(): Record<string, number> {
	if (!browser) return {};
	try {
		const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}');
		return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
	} catch {
		return {};
	}
}

/**
 * When each conversation was last opened on this device. Local on purpose: an unread marker says "new since I
 * looked here", and it is cheap, private and right even offline.
 */
class UnreadStore {
	#lastRead = $state<Record<string, number>>(load());

	#tips = $derived<ConversationTip[]>([
		...data.lists.map(list => {
			const last = data.messagesOf(list.id).at(-1);
			return { id: list.id, lastAt: last?.createdAt ?? 0, lastAuthorId: last?.userId ?? null };
		}),
		...data.directs.map(summary => {
			const last = data.messagesOfConversation(summary.conversationId).at(-1);
			return { id: summary.conversationId, lastAt: summary.lastAt, lastAuthorId: last?.userId ?? null };
		})
	]);

	ids = $derived(unreadIds(this.#tips, this.#lastRead as LastRead, data.me));
	count = $derived(this.ids.length);

	isUnread(id: string): boolean {
		return this.ids.includes(id);
	}

	markRead(id: string): void {
		this.#lastRead = { ...this.#lastRead, [id]: Date.now() };
		try {
			localStorage.setItem(KEY, JSON.stringify(this.#lastRead));
		} catch {
			// A full or blocked storage only means the marker comes back next time.
		}
	}
}

export const unread = new UnreadStore();
