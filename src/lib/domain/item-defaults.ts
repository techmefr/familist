import { slugify } from './slug';

/**
 * What was chosen last time this product was added: the unit (which also says the unit type, one derives
 * from the other) and the aisle. There is no dedicated table for this — the items already typed, across
 * every list of the household, are the history. The same idea as the price memory (`price.ts`): derive
 * from what is already recorded rather than keep a second copy that can drift from it.
 */
export interface ItemDefaults {
	unit: string;
	aisleId: string;
}

interface HistoryEntry {
	name: string;
	unit: string;
	aisleId: string;
	createdAt: number;
}

/**
 * The most recent entry recorded under the same product, or nothing if it has never been added before.
 *
 * Matched by slug rather than by exact name: "Lait" and "lait" are the same product, and so are "Lait" and
 * "lait " typed with a trailing space. An aisle left blank at the time does not overwrite a real choice
 * made since — callers only see entries where one was set.
 */
export function lastUsedFor(history: HistoryEntry[], name: string): ItemDefaults | null {
	const slug = slugify(name);
	if (!slug) return null;

	let best: HistoryEntry | null = null;
	for (const entry of history) {
		if (!entry.aisleId) continue;
		if (slugify(entry.name) !== slug) continue;
		if (!best || entry.createdAt > best.createdAt) best = entry;
	}

	return best ? { unit: best.unit, aisleId: best.aisleId } : null;
}
