import { CARD_TINTS, TINTS } from './tint';

/**
 * The hue palette each theme gives to lists and cards. Lists and cards store a hex, not a palette slot, so
 * nothing is migrated: the stored hex is matched to its slot in the default palettes (`TINTS`, `CARD_TINTS`)
 * and the active theme answers with its own colour for that slot. A hex that is in no default palette — a
 * brand's colour typed by somebody — is left alone.
 *
 * Every entry already carries white text at 4.5:1 (held by the test), `tintForWhiteText` stays the net for
 * whatever else comes in.
 */
export const THEME_TINTS: Record<string, readonly string[]> = {
	pastel: ['#8A5A6B', '#B03A63', '#56744F', '#9A5C30', '#4F6FA8', '#2F6F5E'],
	foret: ['#3F5F44', '#2A7550', '#5B6B2E', '#8A6A2C', '#2F6B73', '#1F5C4A'],
	marine: ['#10214B', '#7A5C16', '#3B5B78', '#8A4B3A', '#4B5575', '#2F5D50'],
	corail: ['#B0343A', '#A3522A', '#8A4F5E', '#7A5C16', '#5A4A6E', '#3F6B4F'],
	lavande: ['#6A4BA8', '#8B3A62', '#4F5FA8', '#3F6F7A', '#7A4A8A', '#5A4A6E'],
	ardoise: ['#2F4B63', '#6B6510', '#4F5B66', '#3F6B5A', '#7A4A3A', '#5A4A2F'],
	night: ['#3B5FA8', '#8B4A9A', '#2F7A66', '#A05A2C', '#4A5BA8', '#8A3A52'],
	dracula: ['#6B4FC8', '#A03A7A', '#2F7A4F', '#A05A2C', '#3A6FA8', '#7A3A4F'],
	'dracula-light': ['#6B4FC8', '#A03A7A', '#1F6B3A', '#A05A2C', '#3A5FA8', '#5A4A6E']
};

const SLOTS = TINTS.length;

function slotOf(hex: string): number {
	const wanted = hex.trim().toLowerCase();
	const inLists = TINTS.findIndex(tint => tint.toLowerCase() === wanted);
	if (inLists >= 0) return inLists;

	const inCards = CARD_TINTS.findIndex(entry => entry.hex.toLowerCase() === wanted);
	return inCards >= 0 ? inCards % SLOTS : -1;
}

export function themedTint(hex: string | null | undefined, themeId: string): string {
	const value = (hex ?? '').trim();
	const palette = THEME_TINTS[themeId];
	if (!palette || !value) return value;

	const slot = slotOf(value);
	return slot >= 0 ? palette[slot] : value;
}
