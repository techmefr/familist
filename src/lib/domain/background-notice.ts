import { decide, type NotificationSettings, type NotificationType } from './notify-rules';

/**
 * What the background listener (Android, no Google services) turns a live change into: a local
 * notification, or nothing. The decision uses the same rules as the server push (#482): the account's
 * switches, muted lists and quiet hours, so the two channels never disagree.
 */
export const LIST_ACTIVITY_GAP_MS = 2 * 60 * 1000;

export interface ChangeMessage {
	table: 'messages';
	listId: string | null;
	conversationId: string | null;
	authorId: string | null;
	isSystem: boolean;
	body: string;
}

export interface ChangeItem {
	table: 'items';
	listId: string;
	name: string;
}

export type Change = ChangeMessage | ChangeItem;

export interface Notice {
	kind: Extract<NotificationType, 'chat' | 'list_activity'>;
	path: string;
	/** The list or conversation id, which debounce and the tap target hang on. */
	groupKey: string;
	listId: string | null;
	name: string;
	body: string;
}

export interface Context {
	me: string;
	isHidden: boolean;
	now: Date;
	settings: NotificationSettings;
	listName: (listId: string) => string;
	memberName: (userId: string) => string;
	lastSent: ReadonlyMap<string, number>;
}

/** The notice for a change, or null when it must stay silent. */
export function noticeFor(change: Change, context: Context): Notice | null {
	// Shown only when the app is out of sight: in front of the person, the screen itself is the news.
	if (!context.isHidden) return null;

	if (change.table === 'messages') {
		if (change.isSystem || change.authorId === context.me || !change.body.trim()) return null;

		const isList = change.listId !== null;
		const groupKey = isList ? `chat:${change.listId}` : `chat:${change.conversationId}`;
		if (!isList && !change.conversationId) return null;
		if (decide('chat', change.listId, context.settings, context.now) !== 'send') return null;

		const sender = change.authorId ? context.memberName(change.authorId) : '';
		return {
			kind: 'chat',
			path: isList ? `/l/${change.listId}/chat` : `/chat/d/${change.conversationId}`,
			groupKey,
			listId: change.listId,
			name: isList ? context.listName(change.listId as string) : sender,
			body: isList && sender ? `${sender}: ${change.body}` : change.body
		};
	}

	if (decide('list_activity', change.listId, context.settings, context.now) !== 'send') return null;

	const groupKey = `list:${change.listId}`;
	const last = context.lastSent.get(groupKey) ?? 0;
	if (context.now.getTime() - last < LIST_ACTIVITY_GAP_MS) return null;

	return { kind: 'list_activity', path: `/l/${change.listId}`, groupKey, listId: change.listId, name: context.listName(change.listId), body: change.name };
}
