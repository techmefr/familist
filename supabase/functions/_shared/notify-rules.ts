/**
 * The rules of a notification that do not depend on the network: which kinds exist, what an account's
 * settings allow, when it is quiet, how rows are grouped into one push and what the grouped text says.
 *
 * Pure on purpose, so the Edge Function that sends and the screen that configures read the same code. The
 * function folder cannot import from `src/lib` (the CLI only copies `supabase/functions` into the Deno
 * container), so `src/lib/domain/notify-rules.ts` is a byte-for-byte copy and a test holds the two equal.
 */
export const NOTIFICATION_TYPES = ['chat', 'list_activity', 'invite', 'card_request', 'poll', 'reminder', 'timer'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface QuietHours {
	enabled: boolean;
	/** "HH:MM", 24 hours, in `timezone`. A window may cross midnight (22:00 to 07:00). */
	start: string;
	end: string;
	timezone: string;
}

export interface NotificationSettings {
	types: Record<NotificationType, boolean>;
	mutedLists: string[];
	quiet: QuietHours;
	locale: string;
}

export const DEFAULT_QUIET: QuietHours = { enabled: true, start: '22:00', end: '07:00', timezone: 'UTC' };

export function defaultSettings(): NotificationSettings {
	return {
		types: Object.fromEntries(NOTIFICATION_TYPES.map(type => [type, true])) as Record<NotificationType, boolean>,
		mutedLists: [],
		quiet: { ...DEFAULT_QUIET },
		locale: 'en'
	};
}

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

function validTimezone(zone: unknown): zone is string {
	if (typeof zone !== 'string' || zone === '') return false;
	try {
		new Intl.DateTimeFormat('en', { timeZone: zone });
		return true;
	} catch {
		return false;
	}
}

/** What is stored is never trusted: anything malformed falls back on the default for that field. */
export function parseSettings(raw: unknown): NotificationSettings {
	const base = defaultSettings();
	if (!raw || typeof raw !== 'object') return base;
	const value = raw as Record<string, unknown>;

	if (value.types && typeof value.types === 'object') {
		for (const type of NOTIFICATION_TYPES) {
			const flag = (value.types as Record<string, unknown>)[type];
			if (typeof flag === 'boolean') base.types[type] = flag;
		}
	}

	if (Array.isArray(value.mutedLists)) {
		base.mutedLists = value.mutedLists.filter((id): id is string => typeof id === 'string').slice(0, 200);
	}

	if (value.quiet && typeof value.quiet === 'object') {
		const quiet = value.quiet as Record<string, unknown>;
		if (typeof quiet.enabled === 'boolean') base.quiet.enabled = quiet.enabled;
		if (typeof quiet.start === 'string' && CLOCK.test(quiet.start)) base.quiet.start = quiet.start;
		if (typeof quiet.end === 'string' && CLOCK.test(quiet.end)) base.quiet.end = quiet.end;
		if (validTimezone(quiet.timezone)) base.quiet.timezone = quiet.timezone;
	}

	if (typeof value.locale === 'string' && value.locale.length <= 10) base.locale = value.locale;

	return base;
}

const minutesOf = (clock: string): number => {
	const [hours, minutes] = clock.split(':').map(Number);
	return hours * 60 + minutes;
};

/** The minutes since midnight at `now` in `timezone`. */
export function minutesInZone(now: Date, timezone: string): number {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: timezone,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(now);
	const hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0);
	const minute = Number(parts.find(part => part.type === 'minute')?.value ?? 0);
	return hour * 60 + minute;
}

export function isQuiet(now: Date, quiet: QuietHours): boolean {
	if (!quiet.enabled) return false;

	const start = minutesOf(quiet.start);
	const end = minutesOf(quiet.end);
	if (start === end) return false;

	const current = minutesInZone(now, quiet.timezone);
	return start < end ? current >= start && current < end : current >= start || current < end;
}

export type Decision = 'send' | 'off' | 'muted' | 'quiet';

/** Whether a notification of `kind` (about `listId`, if any) may go now, and if not, why. */
export function decide(kind: NotificationType, listId: string | null, settings: NotificationSettings, now: Date): Decision {
	if (!settings.types[kind]) return 'off';
	if (listId && settings.mutedLists.includes(listId)) return 'muted';
	if (isQuiet(now, settings.quiet)) return 'quiet';
	return 'send';
}

export interface OutboxRow {
	id: string;
	kind: Exclude<NotificationType, 'reminder' | 'timer'>;
	recipientId: string;
	path: string;
	groupKey: string;
	listId: string | null;
	title: string;
	body: string;
	createdAt: string;
}

export interface Push {
	recipientId: string;
	kind: OutboxRow['kind'];
	title: string;
	body: string;
	path: string;
	ids: string[];
}

const MAX_LINES = 5;

type PhraseKey = 'added' | 'joined' | 'cardRequest' | 'claimed';

const PHRASES: Record<string, Record<PhraseKey, string>> = {
	en: { added: '{name} added {count} item(s)', joined: '{name} joined your household', cardRequest: 'wants to share a loyalty card', claimed: '{name} will bring: {label}' },
	fr: { added: '{name} a ajouté {count} article(s)', joined: '{name} a rejoint votre foyer', cardRequest: 'veut partager une carte de fidélité', claimed: '{name} apporte : {label}' },
	de: { added: '{name} hat {count} Artikel hinzugefügt', joined: '{name} ist Ihrem Haushalt beigetreten', cardRequest: 'möchte eine Kundenkarte teilen', claimed: '{name} bringt mit: {label}' },
	es: { added: '{name} añadió {count} artículo(s)', joined: '{name} se unió a tu hogar', cardRequest: 'quiere compartir una tarjeta de fidelidad', claimed: '{name} trae: {label}' },
	it: { added: '{name} ha aggiunto {count} articolo/i', joined: '{name} è entrato nella tua famiglia', cardRequest: 'vuole condividere una carta fedeltà', claimed: '{name} porta: {label}' },
	pt: { added: '{name} adicionou {count} artigo(s)', joined: '{name} juntou-se ao seu agregado', cardRequest: 'quer partilhar um cartão de fidelidade', claimed: '{name} traz: {label}' },
	ru: { added: '{name} добавил(а) товаров: {count}', joined: '{name} присоединился(ась) к вашей семье', cardRequest: 'хочет поделиться картой лояльности', claimed: '{name} принесёт: {label}' },
	ar: { added: 'أضاف {name} {count} عنصر', joined: 'انضم {name} إلى أسرتك', cardRequest: 'يريد مشاركة بطاقة ولاء', claimed: '{name} سيحضر: {label}' },
	zh: { added: '{name} 添加了 {count} 件商品', joined: '{name} 加入了你的家庭', cardRequest: '想分享一张会员卡', claimed: '{name} 会带：{label}' },
	mg: { added: '{name} nanampy entana {count}', joined: '{name} niditra tao amin’ny ankohonanao', cardRequest: 'maniry hizara karatra', claimed: '{name} no hitondra: {label}' }
};

export function phrase(locale: string, key: PhraseKey, values: Record<string, string | number>): string {
	const table = PHRASES[locale] ?? PHRASES[locale.split('-')[0]] ?? PHRASES.en;
	return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), table[key]);
}

/**
 * Rows of one recipient and one conversation or list become a single push. Chat keeps the latest five lines
 * (oldest first), list activity counts the items, the rest say their one fact.
 */
export function groupRows(rows: readonly OutboxRow[], locale: string): Push[] {
	const groups = new Map<string, OutboxRow[]>();
	for (const row of rows) {
		const key = `${row.recipientId}|${row.groupKey}`;
		groups.set(key, [...(groups.get(key) ?? []), row]);
	}

	return [...groups.values()].map(group => {
		const ordered = group.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
		const first = ordered[0];
		const last = ordered[ordered.length - 1];
		const ids = ordered.map(row => row.id);
		const base = { recipientId: first.recipientId, kind: first.kind, path: last.path, ids };

		switch (first.kind) {
			case 'chat':
				return { ...base, title: last.title, body: ordered.slice(-MAX_LINES).map(row => row.body).join('\n') };
			case 'list_activity':
				return { ...base, title: last.title, body: phrase(locale, 'added', { name: last.body, count: ordered.length }) };
			case 'invite':
				return { ...base, title: last.title, body: phrase(locale, 'joined', { name: last.body }) };
			case 'card_request':
				return { ...base, title: last.title, body: phrase(locale, 'cardRequest', {}) };
			case 'poll':
				return { ...base, title: last.title, body: phrase(locale, 'claimed', { name: last.title, label: last.body }) };
		}
	});
}
