import { describe, expect, it } from 'vitest';
import {
	buildTheme,
	deriveTokens,
	exportThemes,
	importThemes,
	MAX_CUSTOM_THEMES,
	parseCustomThemes,
	validateInput,
	type CustomThemeInput
} from './custom-theme';
import { isAccessible } from './theme-contrast';

const input = (overrides: Partial<CustomThemeInput> = {}): CustomThemeInput => ({
	name: 'Mine',
	base: 'light',
	seed: '#d55053',
	tone: 0.5,
	radius: 0.75,
	...overrides
});

describe('deriveTokens', () => {
	const seeds = ['#d55053', '#ffee00', '#ffffff', '#000000', '#4ea674', '#d7bd88', '#0000ff'];

	for (const base of ['light', 'dark'] as const) {
		for (const seed of seeds) {
			it(`passes every contrast rule for a ${base} theme seeded ${seed}`, () => {
				for (const tone of [0, 0.5, 1]) {
					expect(isAccessible(deriveTokens(input({ base, seed, tone })))).toBe(true);
				}
			});
		}
	}
});

describe('validateInput', () => {
	it('accepts a sound input', () => {
		expect(validateInput(input())).toEqual([]);
	});

	it('refuses an empty name, a bad seed and a bad radius', () => {
		expect(validateInput(input({ name: '  ' }))).toContain('name');
		expect(validateInput(input({ seed: 'red' }))).toContain('seed');
		expect(validateInput(input({ radius: 9 }))).toContain('radius');
	});
});

describe('import and export', () => {
	it('round-trips a theme and derives its tokens again', () => {
		const theme = buildTheme('custom:1', input());
		expect(theme).not.toBeNull();

		const json = exportThemes([theme!]);
		const back = importThemes(json, []);

		expect(back).toHaveLength(1);
		expect(back[0].tokens).toEqual(theme!.tokens);
	});

	it('ignores tokens written by hand in a file', () => {
		const theme = buildTheme('custom:1', input())!;
		const tampered = JSON.stringify({ themes: [{ ...theme, tokens: { background: '#000', foreground: '#010101' } }] });

		expect(importThemes(tampered, [])[0].tokens).toEqual(theme.tokens);
	});

	it('does not import past the cap nor from garbage', () => {
		const full = Array.from({ length: MAX_CUSTOM_THEMES }, (_, n) => buildTheme(`custom:${n + 1}`, input())!);

		expect(importThemes(exportThemes([full[0]]), full)).toEqual([]);
		expect(importThemes('not json', [])).toEqual([]);
		expect(parseCustomThemes('nope')).toEqual([]);
	});

	it('gives imported themes fresh ids', () => {
		const existing = [buildTheme('custom:1', input())!];
		const imported = importThemes(exportThemes(existing), existing);

		expect(imported[0].id).toBe('custom:2');
	});
});
