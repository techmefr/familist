import { luminance, parseHex } from './tint';

export const TEXT_RATIO = 4.5;
export const UI_RATIO = 3;

export interface ContrastRule {
	id: string;
	foreground: string;
	background: string;
	min: number;
}

/**
 * What every theme, shipped or created, must satisfy. Text pairs carry 4.5:1, the icons and focus ring of
 * the interface 3:1. Translucent tokens (borders, tints) are not listed: their effective colour depends on
 * what they sit on, so they are judged through the text that lands on them.
 */
export const CONTRAST_RULES: ContrastRule[] = [
	{ id: 'text', foreground: 'foreground', background: 'background', min: TEXT_RATIO },
	{ id: 'textOnCard', foreground: 'card-foreground', background: 'card', min: TEXT_RATIO },
	{ id: 'mutedText', foreground: 'muted-foreground', background: 'background', min: TEXT_RATIO },
	{ id: 'mutedTextOnCard', foreground: 'muted-foreground', background: 'card', min: TEXT_RATIO },
	{ id: 'textOnButton', foreground: 'primary-foreground', background: 'primary', min: TEXT_RATIO },
	{ id: 'textOnSecondary', foreground: 'secondary-foreground', background: 'secondary', min: TEXT_RATIO },
	{ id: 'accentText', foreground: 'primary', background: 'background', min: TEXT_RATIO },
	{ id: 'accentOnSoft', foreground: 'primary', background: 'accent', min: TEXT_RATIO },
	{ id: 'textOnSoft', foreground: 'accent-foreground', background: 'accent', min: TEXT_RATIO },
	{ id: 'danger', foreground: 'destructive', background: 'background', min: TEXT_RATIO },
	{ id: 'icon', foreground: 'primary', background: 'card', min: UI_RATIO },
	{ id: 'focusRing', foreground: 'ring', background: 'background', min: UI_RATIO },
	{ id: 'mutedIcon', foreground: 'muted-foreground', background: 'muted', min: UI_RATIO }
];

export interface ContrastResult {
	id: string;
	ratio: number;
	min: number;
	isPass: boolean;
}

export function contrastRatio(foreground: string, background: string): number | null {
	const a = parseHex(foreground);
	const b = parseHex(background);
	if (!a || !b) return null;

	const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (high + 0.05) / (low + 0.05);
}

/** A rule whose tokens cannot be read fails: a theme that hides a colour must not pass for lack of data. */
export function checkTheme(tokens: Record<string, string>): ContrastResult[] {
	return CONTRAST_RULES.map(rule => {
		const ratio = contrastRatio(tokens[rule.foreground] ?? '', tokens[rule.background] ?? '');
		return {
			id: rule.id,
			ratio: ratio ?? 0,
			min: rule.min,
			isPass: ratio !== null && ratio >= rule.min
		};
	});
}

export const isAccessible = (tokens: Record<string, string>): boolean =>
	checkTheme(tokens).every(result => result.isPass);
