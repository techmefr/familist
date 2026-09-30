/**
 * Which conversations have something new for me (#485).
 *
 * A conversation is unread when its latest message is someone else's and newer than the moment I last opened
 * it. One badge number counts conversations, not messages: "3" means three places to look at, which is what a
 * tab badge can honestly say.
 */
export interface ConversationTip {
	id: string;
	/** Creation time of the latest message, 0 when there is none. */
	lastAt: number;
	lastAuthorId: string | null;
}

export type LastRead = Readonly<Record<string, number>>;

export function unreadIds(tips: readonly ConversationTip[], lastRead: LastRead, me: string): string[] {
	return tips
		.filter(tip => tip.lastAt > 0 && tip.lastAuthorId !== me && tip.lastAt > (lastRead[tip.id] ?? 0))
		.map(tip => tip.id);
}

/** The badge text: nothing at zero, and "9+" past nine so it never outgrows the tab. */
export function badgeText(count: number): string {
	if (count <= 0) return '';
	return count > 9 ? '9+' : String(count);
}
