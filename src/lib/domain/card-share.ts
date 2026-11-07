export const CARD_SHARE_STATUSES = ['pending', 'accepted', 'declined'] as const;

export type CardShareStatus = (typeof CARD_SHARE_STATUSES)[number];

export type CardShareDecision = Exclude<CardShareStatus, 'pending'>;

export interface CardShareRow {
	cardId: string;
	householdId: string;
	status: CardShareStatus;
}

export interface CircleScopedCard {
	id: string;
	householdId: string;
}

export const toCardShareStatus = (value: unknown): CardShareStatus =>
	CARD_SHARE_STATUSES.includes(value as CardShareStatus) ? (value as CardShareStatus) : 'pending';

export const canDecide = (status: CardShareStatus) => status === 'pending';

export const decide = (status: CardShareStatus, decision: CardShareDecision): CardShareStatus =>
	canDecide(status) ? decision : status;

export const canRequest = (status: CardShareStatus | 'none') =>
	status === 'none' || status === 'declined';

export const shareStatusOf = (
	shares: readonly CardShareRow[],
	cardId: string,
	householdId: string
): CardShareStatus | 'none' =>
	shares.find((share) => share.cardId === cardId && share.householdId === householdId)?.status ??
	'none';

/** How many other households an owned card is shared with and has accepted — a pending request does not count yet. */
export const acceptedShareCount = (shares: readonly CardShareRow[], cardId: string): number =>
	shares.filter((share) => share.cardId === cardId && share.status === 'accepted').length;

/**
 * Every card of every circle the account belongs to, plus those accepted into the active circle. Joining
 * another family must never hide a card: the circle is a filter the person chooses, not a gate.
 */
export const visibleCards = <T extends CircleScopedCard>(
	cards: readonly T[],
	shares: readonly CardShareRow[],
	circle: string,
	ownCircles: readonly string[] = [circle]
): T[] => {
	if (circle === '') return [];
	const mine = new Set(ownCircles);
	mine.add(circle);
	const acceptedIds = new Set(
		shares
			.filter((share) => share.householdId === circle && share.status === 'accepted')
			.map((share) => share.cardId)
	);
	return cards.filter((card) => mine.has(card.householdId) || acceptedIds.has(card.id));
};

export type AccountRevealGate = 'allowed' | 'second-factor' | 'enrol';

/**
 * Read from the session's own level at the moment of asking, never from how the screen was reached. The
 * database checks aal2 again on every read; this only chooses what to say.
 */
export const accountRevealGate = (level: string | null, nextLevel: string | null): AccountRevealGate => {
	if (level === 'aal2') return 'allowed';
	return nextLevel === 'aal2' ? 'second-factor' : 'enrol';
};
