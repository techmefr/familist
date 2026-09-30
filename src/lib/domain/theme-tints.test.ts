import { describe, expect, it } from 'vitest';
import { THEME_PRESETS } from './themes';
import { THEME_TINTS, themedTint } from './theme-tints';
import { CARD_TINTS, TINTS, tintForWhiteText } from './tint';

describe('theme tints', () => {
	it('gives every fixed preset one colour per list slot, all readable under white text', () => {
		for (const preset of THEME_PRESETS.filter(p => p.id !== 'cream-forest')) {
			const palette = THEME_TINTS[preset.id];
			expect(palette, preset.id).toHaveLength(TINTS.length);
			for (const tint of palette) expect(tintForWhiteText(tint), `${preset.id} ${tint}`).toBe(tint.toLowerCase());
		}
	});

	it('leaves the default theme and unknown colours untouched', () => {
		expect(themedTint(TINTS[1], 'cream-forest')).toBe(TINTS[1]);
		expect(themedTint('#123456', 'pastel')).toBe('#123456');
		expect(themedTint(null, 'pastel')).toBe('');
	});

	it('maps a stored list tint and a card tint onto the theme palette', () => {
		expect(themedTint(TINTS[2], 'foret')).toBe(THEME_TINTS.foret[2]);
		expect(themedTint(CARD_TINTS[1].hex, 'foret')).toBe(THEME_TINTS.foret[1]);
	});
});
