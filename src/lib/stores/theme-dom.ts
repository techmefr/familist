import type { CustomTheme } from '$domain/custom-theme';

const applied = new Set<string>();

/**
 * Puts a custom theme's tokens on the root element as inline custom properties, and takes the previous
 * one's off. A preset needs none of this: its values sit in src/themes.css under `data-theme`.
 */
export function applyCustomTokens(root: HTMLElement, theme: CustomTheme | null): void {
	for (const name of applied) root.style.removeProperty(name);
	applied.clear();

	if (!theme) return;

	const entries: [string, string][] = [
		...Object.entries(theme.tokens).map(([name, value]): [string, string] => [`--${name}`, value]),
		['--radius', `${theme.radius}rem`]
	];

	for (const [name, value] of entries) {
		root.style.setProperty(name, value);
		applied.add(name);
	}
}
