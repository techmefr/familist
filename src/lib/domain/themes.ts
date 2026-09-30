/**
 * The palettes a person can choose. The colour values live in src/themes.css under
 * `:root[data-theme='<id>']` (and in src/app.css for the default), this file only carries the list, the
 * grouping and the mode each one forces.
 *
 * `cream-forest` is the only adaptive palette: it has a light and a dark side, chosen by the Light / Dark /
 * System switch and by the accent. Every other preset is one fixed palette, light or dark.
 */
export type ThemeMode = 'light' | 'dark';

export interface ThemePreset {
	id: string;
	/** i18n key of the label. */
	label: string;
	/** `adaptive` follows the Light / Dark / System switch. */
	mode: ThemeMode | 'adaptive';
	/** Colour of the system status bar, equal to `--background` in src/themes.css. */
	themeColor: string;
}

export const DEFAULT_THEME_ID = 'cream-forest';

export const THEME_PRESETS: ThemePreset[] = [
	{ id: 'cream-forest', label: 'themes.creamForest', mode: 'adaptive', themeColor: '#f1ede5' },
	{ id: 'pastel', label: 'themes.pastel', mode: 'light', themeColor: '#fbf1f0' },
	{ id: 'foret', label: 'themes.foret', mode: 'light', themeColor: '#e9f8e7' },
	{ id: 'marine', label: 'themes.marine', mode: 'light', themeColor: '#ebe7e1' },
	{ id: 'corail', label: 'themes.corail', mode: 'light', themeColor: '#fae9d7' },
	{ id: 'lavande', label: 'themes.lavande', mode: 'light', themeColor: '#f3eff8' },
	{ id: 'ardoise', label: 'themes.ardoise', mode: 'light', themeColor: '#f4f3ea' },
	{ id: 'dracula-light', label: 'themes.draculaLight', mode: 'light', themeColor: '#f6f4fa' },
	{ id: 'night', label: 'themes.night', mode: 'dark', themeColor: '#0f1420' },
	{ id: 'dracula', label: 'themes.dracula', mode: 'dark', themeColor: '#282a36' }
];

export const isThemeId = (id: unknown): id is string =>
	typeof id === 'string' && THEME_PRESETS.some(preset => preset.id === id);
