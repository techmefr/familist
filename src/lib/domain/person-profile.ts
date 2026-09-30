import type { AllergySeverity, PersonAllergy, PersonProfile } from '$db/schema';
import { DIET_EXCLUDES, isStandardAllergen, KEYWORDS, matchFoodGroups, type FoodGroup } from './allergens';
import { slugify } from './slug';

export const SEVERITIES: AllergySeverity[] = ['severe', 'intolerance', 'preference'];
export const MAX_ALLERGIES = 40;
export const MAX_TAGS = 60;
export const MAX_TAG_LENGTH = 40;
export const MAX_LABEL_LENGTH = 60;
export const PORTION_MIN = 0.25;
export const PORTION_MAX = 3;

export const AGE_GROUPS = [
	{ id: 'child', portion: 0.5 },
	{ id: 'teen', portion: 1 },
	{ id: 'adult', portion: 1 }
] as const;

const isSeverity = (value: unknown): value is AllergySeverity =>
	typeof value === 'string' && (SEVERITIES as string[]).includes(value);

export function stringList(raw: unknown, max = MAX_TAGS): string[] {
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const out: string[] = [];

	for (const entry of raw) {
		if (typeof entry !== 'string') continue;
		const value = entry.trim().slice(0, MAX_TAG_LENGTH);
		const key = value.toLowerCase();
		if (!value || seen.has(key)) continue;
		seen.add(key);
		out.push(value);
		if (out.length === max) break;
	}
	return out;
}

/** What comes from storage or the database is revalidated: an unknown severity is dropped, not guessed. */
export function parseAllergies(raw: unknown): PersonAllergy[] {
	if (!Array.isArray(raw)) return [];
	const out: PersonAllergy[] = [];

	for (const entry of raw) {
		if (!entry || typeof entry !== 'object') continue;
		const value = entry as Record<string, unknown>;
		const label = typeof value.label === 'string' ? value.label.trim().slice(0, MAX_LABEL_LENGTH) : '';
		if (!label || !isSeverity(value.severity)) continue;

		const id = typeof value.id === 'string' && value.id ? value.id : slugify(label);
		if (!id || out.some(existing => existing.id === id)) continue;
		out.push({ id, label, severity: value.severity });
		if (out.length === MAX_ALLERGIES) break;
	}
	return out;
}

export function clampPortion(value: number): number {
	if (!Number.isFinite(value)) return 1;
	return Math.min(PORTION_MAX, Math.max(PORTION_MIN, Math.round(value * 100) / 100));
}

export function emptyProfile(personId: string, householdId: string, ownerId: string): PersonProfile {
	return {
		personId,
		householdId,
		ownerId,
		allergies: [],
		diets: [],
		likes: [],
		dislikes: [],
		portionFactor: 1,
		guest: false,
		shareWarnings: false,
		updatedAt: Date.now()
	};
}

/** Severest first, so the chips a person reads first are the ones that matter most. */
export function bySeverity(allergies: readonly PersonAllergy[]): PersonAllergy[] {
	return [...allergies].toSorted((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));
}

export interface Conflict {
	personId: string;
	name: string;
	/** What triggered it, as the person wrote it (an allergy) or the rule's key (a diet). */
	because: { kind: 'allergy'; allergy: PersonAllergy } | { kind: 'diet'; diet: string };
	severity: AllergySeverity;
}

export interface Eater {
	personId: string;
	name: string;
	profile: PersonProfile | null;
}

/**
 * Who, among `eaters`, has something against `text` (an ingredient, an item, a recipe's ingredients joined).
 * A standard allergen matches through the dictionary, a custom one by its own label. A diet counts as a
 * severe conflict: someone who eats halal does not want pork as a matter of course.
 */
export function conflictsFor(text: string, locale: string, eaters: readonly Eater[]): Conflict[] {
	const groups = new Set<FoodGroup>(matchFoodGroups(text, locale));
	const folded = text.toLowerCase();
	const out: Conflict[] = [];

	for (const eater of eaters) {
		if (!eater.profile) continue;

		for (const allergy of eater.profile.allergies) {
			const hit = isStandardAllergen(allergy.id)
				? groups.has(allergy.id)
				: folded.includes(allergy.label.toLowerCase());
			if (hit) {
				out.push({
					personId: eater.personId,
					name: eater.name,
					because: { kind: 'allergy', allergy },
					severity: allergy.severity
				});
			}
		}

		for (const diet of eater.profile.diets) {
			if ((DIET_EXCLUDES[diet] ?? []).some(group => groups.has(group))) {
				out.push({ personId: eater.personId, name: eater.name, because: { kind: 'diet', diet }, severity: 'severe' });
			}
		}
	}

	return out.toSorted((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));
}

export const MAX_CONSTRAINTS = 30;
export const MAX_CONSTRAINT_LENGTH = 120;

/**
 * What the AI is told about one person, as short phrases and never with a name: allergies with their
 * severity in words, diets as rules, dislikes. A standard allergen is written in English as well, because
 * the provider reasons better on it and the conflict check reads both.
 */
export function aiConstraints(profile: PersonProfile): string[] {
	const phrases: string[] = [];

	for (const allergy of bySeverity(profile.allergies)) {
		const english = isStandardAllergen(allergy.id) ? KEYWORDS[allergy.id].en[0] : null;
		const name = english && english.toLowerCase() !== allergy.label.toLowerCase() ? `${allergy.label} (${english})` : allergy.label;
		phrases.push(allergy.severity === 'preference' ? `avoid ${name}` : `${name} ${allergy.severity}`);
	}
	for (const diet of profile.diets) phrases.push(diet);
	for (const dislike of profile.dislikes) phrases.push(`dislikes ${dislike}`);

	return phrases;
}

/** The last guard before anything leaves: a bounded list of bounded phrases, nothing else. */
export function capConstraints(constraints: readonly string[]): string[] {
	return constraints
		.map(constraint => constraint.trim().slice(0, MAX_CONSTRAINT_LENGTH))
		.filter(Boolean)
		.slice(0, MAX_CONSTRAINTS);
}

export interface SharedWarningInput {
	personId: string;
	name: string;
	allergens: readonly string[];
	diets: readonly string[];
}

export interface Warning {
	personId: string;
	name: string;
	/** An allergen label or a diet key. */
	what: string;
	kind: 'allergy' | 'diet';
	/** Only known for the owner's own profile; a shared warning carries no severity. */
	severity: AllergySeverity | null;
}

/**
 * Everything worth warning about for `text`: the owner's own conflicts with their severity, then the
 * warnings other members agreed to share, which say what and for whom, nothing more.
 */
export function warningsFor(
	text: string,
	locale: string,
	own: readonly Eater[],
	shared: readonly SharedWarningInput[]
): Warning[] {
	const out: Warning[] = conflictsFor(text, locale, own).map(conflict =>
		conflict.because.kind === 'allergy'
			? { personId: conflict.personId, name: conflict.name, what: conflict.because.allergy.label, kind: 'allergy', severity: conflict.severity }
			: { personId: conflict.personId, name: conflict.name, what: conflict.because.diet, kind: 'diet', severity: null }
	);

	const groups = new Set<FoodGroup>(matchFoodGroups(text, locale));
	const folded = text.toLowerCase();

	for (const entry of shared) {
		for (const label of entry.allergens) {
			const labelGroups = matchFoodGroups(label, locale);
			if (labelGroups.some(group => groups.has(group)) || folded.includes(label.toLowerCase())) {
				out.push({ personId: entry.personId, name: entry.name, what: label, kind: 'allergy', severity: null });
			}
		}
		for (const diet of entry.diets) {
			if ((DIET_EXCLUDES[diet] ?? []).some(group => groups.has(group))) {
				out.push({ personId: entry.personId, name: entry.name, what: diet, kind: 'diet', severity: null });
			}
		}
	}

	return out;
}

/**
 * How many portions a meal for these people needs: each person counts for their portion factor, one when
 * their profile is not readable (someone else's). Null with nobody on the roster, so the caller keeps the
 * recipe's own number of servings.
 */
export function portionsFor(eaters: readonly Eater[]): number | null {
	if (eaters.length === 0) return null;
	const total = eaters.reduce((sum, eater) => sum + (eater.profile?.portionFactor ?? 1), 0);
	return Math.max(1, Math.round(total));
}

/**
 * Warnings for a product whose allergens are already known as standard ids (Open Food Facts), so no word
 * matching is needed: a profile allergy hits when its id is among them, a diet when it excludes one of them.
 */
export function productWarnings(allergens: readonly string[], eaters: readonly Eater[]): Warning[] {
	const present = new Set(allergens);
	const out: Warning[] = [];

	for (const eater of eaters) {
		if (!eater.profile) continue;

		for (const allergy of eater.profile.allergies) {
			if (present.has(allergy.id)) {
				out.push({ personId: eater.personId, name: eater.name, what: allergy.label, kind: 'allergy', severity: allergy.severity });
			}
		}
		for (const diet of eater.profile.diets) {
			if ((DIET_EXCLUDES[diet] ?? []).some(group => present.has(group))) {
				out.push({ personId: eater.personId, name: eater.name, what: diet, kind: 'diet', severity: null });
			}
		}
	}

	return out;
}
