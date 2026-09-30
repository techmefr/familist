import { browser } from '$app/environment';
import type { Json } from '$db/types';
import { localWins as arbitrate, type AppearanceRow } from '$domain/appearance';
import {
	buildTheme,
	exportThemes,
	importThemes,
	isCustomThemeId,
	MAX_CUSTOM_THEMES,
	nextThemeId,
	parseCustomThemes,
	validateInput,
	type CustomTheme,
	type CustomThemeInput,
	type ThemeProblem
} from '$domain/custom-theme';
import { DEFAULT_THEME_ID, THEME_PRESETS } from '$domain/themes';
import {
	defaultSettings as defaultNotificationSettings,
	parseSettings as parseNotificationSettings,
	type NotificationSettings,
	type NotificationType
} from '$domain/notify-rules';
import { applyCustomTokens } from './theme-dom';
import { isHand, type Hand } from '$domain/hand';
import { animates, isMotionPreference, type MotionPreference } from '$domain/motion';
import {
	ACCENT_PRESETS,
	DEFAULT_ACCENT,
	DEFAULT_FONT,
	DEFAULT_FONT_SCALE,
	DEFAULT_HAND,
	DEFAULT_HAPTICS,
	DEFAULT_MOTION,
	DEFAULT_NEARBY_CARDS,
	DEFAULT_SOUND,
	FONT_PRESETS,
	FONT_SCALE_PRESETS,
	STORAGE_KEY,
	THEME_COLORS,
	type Theme
} from './preferences';

export { ACCENT_PRESETS, FONT_PRESETS, FONT_SCALE_PRESETS, type Theme };
export { MOTION_PREFERENCES, type MotionPreference } from '$domain/motion';
export { HANDS, type Hand } from '$domain/hand';
export type { AppearanceRow } from '$domain/appearance';

const THEMES: Theme[] = ['light', 'dark', 'system'];

/** The device's own timezone: quiet hours mean the local evening, wherever the account was made. */
function deviceTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
	} catch {
		return 'UTC';
	}
}

class Settings {
	theme = $state<Theme>('system');
	themeId = $state<string>(DEFAULT_THEME_ID);
	customThemes = $state<CustomTheme[]>([]);
	notifications = $state<NotificationSettings>(defaultNotificationSettings());
	accentId = $state<string>(DEFAULT_ACCENT);
	fontScaleId = $state<string>(DEFAULT_FONT_SCALE);
	fontId = $state<string>(DEFAULT_FONT);
	motion = $state<MotionPreference>(DEFAULT_MOTION);
	hand = $state<Hand>(DEFAULT_HAND);
	sound = $state(DEFAULT_SOUND);
	haptics = $state(DEFAULT_HAPTICS);
	nearbyCards = $state(DEFAULT_NEARBY_CARDS);
	hasSeenTour = $state(false);

	/**
	 * The welcome journey plays before an account exists: this marker therefore stays on the device and
	 * does not go to the database, unlike the guided tour's.
	 */
	hasSeenWelcome = $state(false);

	/**
	 * The last app version whose "what's new" modal this device has acknowledged.
	 *
	 * Stays on the device, like `hasSeenWelcome`: a synced, per-account marker would need a migration and
	 * would show the modal again on a fresh device that already knows the account, which defeats its point
	 * — this is about *this browser or install* having seen the notice, not the person.
	 */
	lastSeenChangelogVersion = $state('');

	#prefersDark = $state(false);
	#prefersReducedMotion = $state(false);

	/**
	 * Sync timestamps. Deliberately outside `$state`: the effect that saves the preferences reads them, and
	 * making them reactive would have it re-trigger itself in a loop.
	 *
	 * `#syncedFor` remembers which account the last send served. Without it, there is no telling "I have
	 * just set my text size during the welcome, before even having an account" — where the device is right
	 * — from "I am opening the application on the tablet" — where the database is right.
	 */
	#changedAt = 0;
	#syncedAt = 0;
	#syncedFor: string | null = null;

	activeCustomTheme = $derived(this.customThemes.find(theme => theme.id === this.themeId) ?? null);

	/**
	 * A fixed palette decides by itself whether it is dark; only the default, adaptive one follows the
	 * Light / Dark / System switch.
	 */
	isDark = $derived.by(() => {
		if (this.activeCustomTheme) return this.activeCustomTheme.base === 'dark';

		const preset = THEME_PRESETS.find(candidate => candidate.id === this.themeId);
		if (preset && preset.mode !== 'adaptive') return preset.mode === 'dark';

		return this.theme === 'dark' || (this.theme === 'system' && this.#prefersDark);
	});

	/**
	 * The only place answering "do we animate". Svelte transitions receive a duration computed in
	 * JavaScript, the CSS has its own guard on `data-motion`: the two must say the same thing, so they must
	 * start from the same value.
	 */
	animates = $derived(animates(this.motion, this.#prefersReducedMotion));

	constructor() {
		if (!browser) return;

		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
			if (saved.theme) this.theme = saved.theme;
			this.notifications = parseNotificationSettings(saved.notifications ?? { quiet: { timezone: deviceTimezone() } });
			this.customThemes = parseCustomThemes(saved.customThemes);
			if (this.#knowsTheme(saved.themeId)) this.themeId = saved.themeId;
			if (saved.accentId) this.accentId = saved.accentId;
			if (saved.fontScaleId) this.fontScaleId = saved.fontScaleId;
			if (saved.fontId) this.fontId = saved.fontId;
			if (isMotionPreference(saved.motion)) this.motion = saved.motion;
			if (isHand(saved.hand)) this.hand = saved.hand;
			if (typeof saved.sound === 'boolean') this.sound = saved.sound;
			if (typeof saved.haptics === 'boolean') this.haptics = saved.haptics;
			if (typeof saved.nearbyCards === 'boolean') this.nearbyCards = saved.nearbyCards;
			if (typeof saved.hasSeenTour === 'boolean') this.hasSeenTour = saved.hasSeenTour;
			if (typeof saved.hasSeenWelcome === 'boolean') this.hasSeenWelcome = saved.hasSeenWelcome;
			if (typeof saved.lastSeenChangelogVersion === 'string')
				this.lastSeenChangelogVersion = saved.lastSeenChangelogVersion;
			if (typeof saved.changedAt === 'number') this.#changedAt = saved.changedAt;
			if (typeof saved.syncedAt === 'number') this.#syncedAt = saved.syncedAt;
			if (typeof saved.syncedFor === 'string') this.#syncedFor = saved.syncedFor;
		} catch {
			// unreadable preferences, we keep the defaults
		}

		const dark = matchMedia('(prefers-color-scheme: dark)');
		this.#prefersDark = dark.matches;
		dark.addEventListener('change', (event) => {
			this.#prefersDark = event.matches;
		});

		const reduced = matchMedia('(prefers-reduced-motion: reduce)');
		this.#prefersReducedMotion = reduced.matches;
		reduced.addEventListener('change', (event) => {
			this.#prefersReducedMotion = event.matches;
		});

		$effect.root(() => {
			$effect(() => {
				const root = document.documentElement;

				root.classList.toggle('dark', this.isDark);
				root.dataset.theme = this.activeCustomTheme ? 'custom' : this.themeId;
				applyCustomTokens(root, this.activeCustomTheme);
				root.dataset.accent = this.accentId;
				root.dataset.scale = this.fontScaleId;
				root.dataset.font = this.fontId;
				root.dataset.motion = this.motion;
				root.dataset.hand = this.hand;

				// The system status bar follows the chosen theme, not the device's.
				document
					.querySelector('meta[name="theme-color"]')
					?.setAttribute('content', this.#statusBarColor());

				localStorage.setItem(
					STORAGE_KEY,
					JSON.stringify({
						theme: this.theme,
						themeId: this.themeId,
						customThemes: this.customThemes,
						notifications: this.notifications,
						accentId: this.accentId,
						fontScaleId: this.fontScaleId,
						fontId: this.fontId,
						motion: this.motion,
						hand: this.hand,
						sound: this.sound,
						haptics: this.haptics,
						nearbyCards: this.nearbyCards,
						hasSeenTour: this.hasSeenTour,
						hasSeenWelcome: this.hasSeenWelcome,
						lastSeenChangelogVersion: this.lastSeenChangelogVersion,
						changedAt: this.#changedAt,
						syncedAt: this.#syncedAt,
						syncedFor: this.#syncedFor
					})
				);
			});
		});
	}

	#knowsTheme(id: unknown): id is string {
		if (typeof id !== 'string') return false;
		return THEME_PRESETS.some(preset => preset.id === id) || this.customThemes.some(t => t.id === id);
	}

	#statusBarColor(): string {
		if (this.activeCustomTheme) return this.activeCustomTheme.tokens.background;

		const preset = THEME_PRESETS.find(candidate => candidate.id === this.themeId);
		if (preset && preset.mode !== 'adaptive') return preset.themeColor;

		return this.isDark ? THEME_COLORS.dark : THEME_COLORS.light;
	}

	/** Every change coming from the interface goes through here, to date the change. */
	#touch() {
		this.#changedAt = Date.now();
	}

	setTheme(theme: Theme) {
		if (!THEMES.includes(theme)) return;
		this.#touch();
		this.theme = theme;
	}

	setThemeId(id: string) {
		if (!this.#knowsTheme(id)) return;
		this.#touch();
		this.themeId = id;
	}

	/**
	 * Saves a theme made in the creator, a new one or a replacement for `id`. Refuses, and says why, when the
	 * input is unsound, when it reads below the contrast thresholds or when five themes already exist.
	 */
	saveCustomTheme(input: CustomThemeInput, id: string | null = null): ThemeProblem[] | 'full' {
		const problems = validateInput(input);
		if (problems.length > 0) return problems;

		const isNew = id === null || !this.customThemes.some(theme => theme.id === id);
		if (isNew && this.customThemes.length >= MAX_CUSTOM_THEMES) return 'full';

		const themeId = id ?? nextThemeId(this.customThemes);
		const theme = buildTheme(themeId, input);
		if (!theme) return ['contrast'];

		this.#touch();
		this.customThemes = isNew
			? [...this.customThemes, theme]
			: this.customThemes.map(existing => (existing.id === themeId ? theme : existing));
		this.themeId = themeId;
		return [];
	}

	deleteCustomTheme(id: string) {
		if (!isCustomThemeId(id)) return;
		this.#touch();
		this.customThemes = this.customThemes.filter(theme => theme.id !== id);
		if (this.themeId === id) this.themeId = DEFAULT_THEME_ID;
	}

	exportCustomThemes(): string {
		return exportThemes(this.customThemes);
	}

	/** Returns how many themes the file added. */
	importCustomThemes(json: string): number {
		const added = importThemes(json, this.customThemes);
		if (added.length === 0) return 0;

		this.#touch();
		this.customThemes = [...this.customThemes, ...added];
		return added.length;
	}

	setNotificationType(type: NotificationType, isOn: boolean) {
		this.#touch();
		this.notifications = { ...this.notifications, types: { ...this.notifications.types, [type]: isOn } };
	}

	setListMuted(listId: string, isMuted: boolean) {
		this.#touch();
		const others = this.notifications.mutedLists.filter(id => id !== listId);
		this.notifications = { ...this.notifications, mutedLists: isMuted ? [...others, listId] : others };
	}

	setQuietHours(quiet: Partial<NotificationSettings['quiet']>) {
		this.#touch();
		this.notifications = parseNotificationSettings({
			...this.notifications,
			quiet: { ...this.notifications.quiet, ...quiet }
		});
	}

	/** Kept in the synced row so the server words each push in the person's own language. */
	setNotificationLocale(locale: string) {
		if (this.notifications.locale === locale) return;
		this.notifications = { ...this.notifications, locale };
	}

	setAccent(id: string) {
		if (!ACCENT_PRESETS.some((a) => a.id === id)) return;
		this.#touch();
		this.accentId = id;
	}

	setFontScale(id: string) {
		if (!FONT_SCALE_PRESETS.some((f) => f.id === id)) return;
		this.#touch();
		this.fontScaleId = id;
	}

	setFont(id: string) {
		if (!FONT_PRESETS.some((f) => f.id === id)) return;
		this.#touch();
		this.fontId = id;
	}

	setMotion(preference: MotionPreference) {
		if (!isMotionPreference(preference)) return;
		this.#touch();
		this.motion = preference;
	}

	setHand(hand: Hand) {
		if (!isHand(hand)) return;
		this.#touch();
		this.hand = hand;
	}

	setSound(enabled: boolean) {
		this.#touch();
		this.sound = enabled;
	}

	setHaptics(enabled: boolean) {
		this.#touch();
		this.haptics = enabled;
	}

	setNearbyCards(enabled: boolean) {
		this.#touch();
		this.nearbyCards = enabled;
	}

	setTourSeen(seen: boolean) {
		this.#touch();
		this.hasSeenTour = seen;
	}

	setWelcomeSeen(seen: boolean) {
		this.hasSeenWelcome = seen;
	}

	setChangelogSeen(version: string) {
		this.lastSeenChangelogVersion = version;
	}

	/**
	 * Forgets which account this device last arbitrated its appearance for.
	 *
	 * Called on sign-out, alongside the local data cache being emptied: without it, a shared device hands
	 * the next account the previous one's `hasSeenTour` and sync bookkeeping. `localWins` would then read
	 * a `syncedFor` that matches neither account and a `hasSeenTour` that was never this account's to
	 * begin with — the guided tour silently skips itself for someone who has genuinely never seen it here,
	 * until (if ever) a later pull happens to correct it. Resetting the bookkeeping to its pre-sync state
	 * forces a clean pull for whoever signs in next.
	 */
	forgetAccount() {
		this.hasSeenTour = false;
		this.#changedAt = 0;
		this.#syncedAt = 0;
		this.#syncedFor = null;
		this.persist();
	}

	/** See `localWins` in `$domain/appearance` — kept there so the arbitration itself is testable without a store. */
	localWins(userId: string) {
		return arbitrate(
			{ changedAt: this.#changedAt, syncedAt: this.#syncedAt, syncedFor: this.#syncedFor },
			userId
		);
	}

	snapshot(): AppearanceRow {
		return {
			theme: this.theme,
			theme_id: this.themeId,
			custom_themes: this.customThemes.map(({ tokens: _tokens, ...inputs }) => inputs),
			notification_settings: this.notifications as unknown as Json,
			accent_id: this.accentId,
			type_scale: this.fontScaleId,
			font_id: this.fontId,
			motion: this.motion,
			hand: this.hand,
			sound: this.sound,
			haptics: this.haptics,
			nearby_cards: this.nearbyCards,
			has_seen_tour: this.hasSeenTour
		};
	}

	/**
	 * Applies what the database says. Each value is revalidated: the SQL constraint and the list of presets
	 * can diverge for the duration of a deployment, and an unknown value must leave the default in place
	 * rather than set a `data-accent` the CSS does not know.
	 */
	adoptRemote(row: Partial<AppearanceRow>, userId: string) {
		if (THEMES.includes(row.theme as Theme)) this.theme = row.theme as Theme;
		if (
			row.notification_settings &&
			typeof row.notification_settings === 'object' &&
			Object.keys(row.notification_settings).length > 0
		)
			this.notifications = parseNotificationSettings(row.notification_settings);
		if (Array.isArray(row.custom_themes)) this.customThemes = parseCustomThemes(row.custom_themes);
		if (this.#knowsTheme(row.theme_id)) this.themeId = row.theme_id;
		else if (this.themeId !== DEFAULT_THEME_ID && !this.#knowsTheme(this.themeId))
			this.themeId = DEFAULT_THEME_ID;
		if (ACCENT_PRESETS.some((a) => a.id === row.accent_id)) this.accentId = row.accent_id as string;
		if (FONT_SCALE_PRESETS.some((f) => f.id === row.type_scale))
			this.fontScaleId = row.type_scale as string;
		if (FONT_PRESETS.some((f) => f.id === row.font_id)) this.fontId = row.font_id as string;
		if (isMotionPreference(row.motion)) this.motion = row.motion;
		if (isHand(row.hand)) this.hand = row.hand;
		if (typeof row.sound === 'boolean') this.sound = row.sound;
		if (typeof row.haptics === 'boolean') this.haptics = row.haptics;
		if (typeof row.nearby_cards === 'boolean') this.nearbyCards = row.nearby_cards;
		if (typeof row.has_seen_tour === 'boolean') this.hasSeenTour = row.has_seen_tour;

		this.markSynced(userId);
	}

	markSynced(userId: string) {
		this.#syncedFor = userId;
		this.#syncedAt = Date.now();
		this.#changedAt = this.#syncedAt;

		// The effect only watches reactive values: without this write, the timestamp would stay in memory and
		// the next start would send everything a second time.
		this.persist();
	}

	persist() {
		if (!browser) return;

		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				...saved,
				changedAt: this.#changedAt,
				syncedAt: this.#syncedAt,
				syncedFor: this.#syncedFor
			})
		);
	}
}

export const settings = new Settings();

/**
 * Duration of a Svelte transition, cut to nothing when motion is refused. Passing 0 rather than removing
 * the directive keeps the same code on both sides, and the element still appears.
 */
export const motionMs = (ms: number) => (settings.animates ? ms : 0);
