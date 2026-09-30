import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkTheme } from './theme-contrast';
import { THEME_PRESETS } from './themes';

const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

function declarations(body: string): Record<string, string> {
	const tokens: Record<string, string> = {};
	for (const [, name, value] of body.matchAll(/--([a-z-]+):\s*([^;]+);/g)) tokens[name] = value.trim();
	return tokens;
}

function block(css: string, selector: string): Record<string, string> {
	const start = css.indexOf(`${selector} {`);
	if (start < 0) throw new Error(`no block for ${selector}`);
	return declarations(css.slice(start, css.indexOf('}', start)));
}

const appCss = read('app.css');
const themesCss = read('themes.css');

const SETS: Record<string, Record<string, string>> = {
	'cream-forest': block(appCss, ':root,\n[data-theme-preview=\'cream-forest\']'),
	'cream-forest (dark)': { ...block(appCss, ':root,\n[data-theme-preview=\'cream-forest\']'), ...block(appCss, '.dark') }
};
for (const preset of THEME_PRESETS.filter(p => p.id !== 'cream-forest')) {
	SETS[preset.id] = block(themesCss, `:root[data-theme='${preset.id}'], [data-theme-preview='${preset.id}']`);
}

describe('theme contrast', () => {
	for (const [name, tokens] of Object.entries(SETS)) {
		it(`${name} passes every contrast rule`, () => {
			const failing = checkTheme(tokens).filter(r => !r.isPass);
			expect(failing.map(r => `${r.id} ${r.ratio.toFixed(2)}<${r.min}`)).toEqual([]);
		});
	}

	it('ships the ten presets', () => {
		expect(THEME_PRESETS).toHaveLength(10);
	});

	it('keeps the status bar colour equal to --background', () => {
		for (const preset of THEME_PRESETS.filter(p => p.id !== 'cream-forest')) {
			expect(SETS[preset.id].background.toLowerCase()).toBe(preset.themeColor);
		}
	});
});

describe('pre-paint script', () => {
	const html = read('app.html');

	it('knows the mode and status bar colour of every fixed preset', () => {
		const listed = (name: string) =>
			[...(html.match(new RegExp(`${name} = \\[([^\\]]*)\\]`))?.[1].matchAll(/'([a-z-]+)'/g) ?? [])].map(m => m[1]);

		const dark = listed('DARK_PRESETS');
		const light = listed('LIGHT_PRESETS');

		for (const preset of THEME_PRESETS.filter(p => p.mode !== 'adaptive')) {
			expect(preset.mode === 'dark' ? dark : light).toContain(preset.id);
			expect(html).toContain(preset.themeColor);
		}
	});
});
