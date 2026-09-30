import { contrastRatio, isAccessible, TEXT_RATIO } from './theme-contrast';
import type { ThemeMode } from './themes';
import { parseHex, type Rgb } from './tint';

export const MAX_CUSTOM_THEMES = 5;
export const CUSTOM_THEME_PREFIX = 'custom:';
export const MIN_RADIUS = 0;
export const MAX_RADIUS = 1.5;
export const DEFAULT_RADIUS = 0.75;
export const NAME_MAX_LENGTH = 24;

const HEX = /^#[0-9a-f]{6}$/i;
const STEP = 0.04;
const MAX_STEPS = 40;

export interface CustomThemeInput {
	name: string;
	base: ThemeMode;
	seed: string;
	/** 0 is the plainest ground, 1 the most tinted by the seed. */
	tone: number;
	radius: number;
}

export interface CustomTheme extends CustomThemeInput {
	id: string;
	tokens: Record<string, string>;
}

const byte = (v: number) =>
	Math.round(Math.max(0, Math.min(255, v)))
		.toString(16)
		.padStart(2, '0');

const toHex = ({ r, g, b }: Rgb) => `#${byte(r)}${byte(g)}${byte(b)}`;

function mix(a: string, b: string, weight: number): string {
	const from = parseHex(a) as Rgb;
	const to = parseHex(b) as Rgb;
	return toHex({
		r: from.r * (1 - weight) + to.r * weight,
		g: from.g * (1 - weight) + to.g * weight,
		b: from.b * (1 - weight) + to.b * weight
	});
}

function alpha(hex: string, value: number): string {
	const { r, g, b } = parseHex(hex) as Rgb;
	return `rgb(${r} ${g} ${b} / ${value})`;
}

/**
 * Moves `color` toward `target` until `isEnough` holds. Convergence is guaranteed since black and white
 * carry every pair we ask for; the loop is bounded all the same.
 */
function pushUntil(color: string, target: string, isEnough: (candidate: string) => boolean): string {
	let current = color;
	for (let i = 0; i < MAX_STEPS && !isEnough(current); i++) current = mix(current, target, STEP * 2);
	return current;
}

const ratio = (a: string, b: string): number => contrastRatio(a, b) ?? 0;

export const isHexColor = (value: unknown): value is string =>
	typeof value === 'string' && HEX.test(value);

/**
 * The whole token set from a seed colour. The seed only decides the hue: the accent is darkened (light) or
 * lightened (dark) until its text, its button, its soft ground and the page all read at 4.5:1, the same
 * loop `tintForWhiteText` runs for the tints. The muted text is mixed from the ink and pulled until it
 * passes as well.
 */
export function deriveTokens(input: CustomThemeInput): Record<string, string> {
	const isDark = input.base === 'dark';
	const tone = Math.max(0, Math.min(1, input.tone));
	const ink = isDark ? mix('#ffffff', input.seed, 0.06) : mix('#000000', input.seed, 0.18);
	const plain = isDark ? '#0f0f12' : '#faf8f4';
	const background = mix(plain, input.seed, 0.03 + tone * (isDark ? 0.1 : 0.1));
	const card = isDark ? mix(background, '#ffffff', 0.06) : mix(background, '#ffffff', 0.7);
	const soft = mix(background, input.seed, isDark ? 0.22 : 0.16);
	const toward = isDark ? '#ffffff' : '#000000';
	const onPrimary = isDark ? background : '#ffffff';

	const primary = pushUntil(input.seed, toward, candidate =>
		[
			ratio(onPrimary, candidate),
			ratio(candidate, background),
			ratio(candidate, soft),
			ratio(candidate, card)
		].every(value => value >= TEXT_RATIO + 0.05)
	);
	const secondary = pushUntil(mix(input.seed, isDark ? '#6fc28c' : '#1f5c3a', 0.7), toward, candidate =>
		ratio(isDark ? background : '#ffffff', candidate) >= TEXT_RATIO + 0.05
	);
	const muted = pushUntil(mix(ink, background, 0.35), ink, candidate =>
		[ratio(candidate, background), ratio(candidate, card)].every(value => value >= TEXT_RATIO + 0.05)
	);
	const mutedSurface = isDark ? mix(background, '#000000', 0.15) : mix(background, ink, 0.07);
	const shadow = (value: number) => alpha(isDark ? '#000000' : ink, value * (isDark ? 1.4 : 1));

	return {
		background,
		foreground: ink,
		card,
		'card-foreground': ink,
		popover: isDark ? mix(card, '#ffffff', 0.05) : card,
		'popover-foreground': ink,
		primary,
		'primary-foreground': onPrimary,
		secondary,
		'secondary-foreground': isDark ? background : '#ffffff',
		muted: mutedSurface,
		'muted-foreground': muted,
		accent: soft,
		'accent-foreground': ink,
		destructive: isDark ? '#f08a8a' : '#b91c1c',
		'destructive-foreground': isDark ? '#1c1411' : '#ffffff',
		border: alpha(ink, isDark ? 0.1 : 0.08),
		input: alpha(ink, isDark ? 0.16 : 0.14),
		ring: primary,
		'fl-primary-hover': mix(primary, toward, 0.12),
		'fl-primary-pressed': mix(primary, toward, 0.22),
		'fl-primary-tint': alpha(primary, isDark ? 0.14 : 0.1),
		'fl-secondary-tint': alpha(secondary, isDark ? 0.14 : 0.1),
		'fl-border-strong': alpha(ink, isDark ? 0.16 : 0.14),
		'fl-text-tertiary': mix(muted, background, 0.3),
		'fl-text-disabled': mix(ink, background, 0.72),
		'fl-scrim': isDark ? 'rgb(0 0 0 / 0.64)' : alpha(mix(ink, '#000000', 0.5), 0.46),
		'fl-info': isDark ? '#7ba7f7' : '#2563eb',
		'fl-warning': isDark ? '#e8b365' : '#b45309',
		'fl-success': secondary,
		'fl-shadow-1': `0 1px 2px ${shadow(0.06)}, 0 2px 6px ${shadow(0.04)}`,
		'fl-shadow-2': `0 4px 14px ${shadow(0.08)}, 0 1px 3px ${shadow(0.05)}`,
		'fl-shadow-3': `0 16px 40px ${shadow(0.14)}, 0 4px 12px ${shadow(0.06)}`,
		'fl-shadow-4': `0 28px 60px ${shadow(0.22)}, 0 8px 18px ${shadow(0.1)}`
	};
}

export type ThemeProblem = 'name' | 'seed' | 'base' | 'radius' | 'contrast';

/** Why an input cannot be saved, empty when it can. A theme under the thresholds is refused, never shipped. */
export function validateInput(input: CustomThemeInput): ThemeProblem[] {
	const problems: ThemeProblem[] = [];
	const name = input.name.trim();

	if (name.length === 0 || name.length > NAME_MAX_LENGTH) problems.push('name');
	if (!isHexColor(input.seed)) problems.push('seed');
	if (input.base !== 'light' && input.base !== 'dark') problems.push('base');
	if (!(input.radius >= MIN_RADIUS && input.radius <= MAX_RADIUS)) problems.push('radius');
	if (problems.length > 0) return problems;

	return isAccessible(deriveTokens(input)) ? [] : ['contrast'];
}

export function buildTheme(id: string, input: CustomThemeInput): CustomTheme | null {
	if (validateInput(input).length > 0) return null;
	return { ...input, name: input.name.trim(), id, tokens: deriveTokens(input) };
}

/**
 * A theme read back from storage, the database or an imported file. Only the inputs are trusted, the
 * tokens are derived again: a hand-edited file cannot slip a low-contrast palette past the validator.
 */
export function parseCustomTheme(raw: unknown): CustomTheme | null {
	if (!raw || typeof raw !== 'object') return null;
	const value = raw as Record<string, unknown>;

	if (typeof value.id !== 'string' || !value.id.startsWith(CUSTOM_THEME_PREFIX)) return null;
	if (typeof value.name !== 'string' || typeof value.seed !== 'string') return null;
	if (value.base !== 'light' && value.base !== 'dark') return null;
	if (typeof value.tone !== 'number' || typeof value.radius !== 'number') return null;

	return buildTheme(value.id, {
		name: value.name,
		base: value.base,
		seed: value.seed.toLowerCase(),
		tone: value.tone,
		radius: value.radius
	});
}

export function parseCustomThemes(raw: unknown): CustomTheme[] {
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const themes: CustomTheme[] = [];

	for (const entry of raw) {
		const theme = parseCustomTheme(entry);
		if (!theme || seen.has(theme.id)) continue;
		seen.add(theme.id);
		themes.push(theme);
		if (themes.length === MAX_CUSTOM_THEMES) break;
	}

	return themes;
}

export function exportThemes(themes: CustomTheme[]): string {
	const inputs = themes.map(({ id, name, base, seed, tone, radius }) => ({
		id,
		name,
		base,
		seed,
		tone,
		radius
	}));
	return JSON.stringify({ familistThemes: 1, themes: inputs }, null, 2);
}

/** Imported themes get fresh ids so they never overwrite an existing one. */
export function importThemes(json: string, existing: CustomTheme[]): CustomTheme[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return [];
	}
	if (!parsed || typeof parsed !== 'object') return [];
	const list = (parsed as { themes?: unknown }).themes;
	if (!Array.isArray(list)) return [];

	const room = MAX_CUSTOM_THEMES - existing.length;
	const imported: CustomTheme[] = [];

	for (const entry of list.slice(0, Math.max(0, room))) {
		if (!entry || typeof entry !== 'object') continue;
		const draft = { ...(entry as Record<string, unknown>), id: nextThemeId([...existing, ...imported]) };
		const theme = parseCustomTheme(draft);
		if (theme) imported.push(theme);
	}

	return imported;
}

export function nextThemeId(existing: CustomTheme[]): string {
	const used = new Set(existing.map(theme => theme.id));
	for (let n = 1; n <= MAX_CUSTOM_THEMES + 1; n++) {
		if (!used.has(`${CUSTOM_THEME_PREFIX}${n}`)) return `${CUSTOM_THEME_PREFIX}${n}`;
	}
	return `${CUSTOM_THEME_PREFIX}${Date.now()}`;
}

export const isCustomThemeId = (id: string): boolean => id.startsWith(CUSTOM_THEME_PREFIX);
