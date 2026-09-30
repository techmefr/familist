/**
 * When to remind about a dated list, and which one still deserves a reminder.
 *
 * Everything is pure and platform-free: it is the only part of the feature that can be tested, and also
 * the only one that decides. The native layer only carries out what is computed here.
 */

/** An event date is a day, not an instant: "on 14 February", not "2.32pm". */
const EVENT_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The reminder falls the evening before, not on the day itself.
 *
 * The need is not to miss a recipe's ingredients *before* the date: warning on the morning of the meal
 * comes too late, you would still have to find time to get to the shop. 6pm the day before leaves the
 * evening to drop by, and it is the hour you come home rather than the hour you sleep.
 */
export const REMINDER_HOUR = 18;
export const REMINDER_DAYS_BEFORE = 1;

export interface ReminderCandidate {
	listId: string;
	name: string;
	eventDate?: string;
	total: number;
	done: number;
}

export interface ReminderPlan {
	/** The list, or the menu, this reminder is about. */
	listId: string;
	/** Integer id required by local notifications, derived from the list id. */
	id: number;
	name: string;
	eventDate: string;
	at: Date;
	/** Ready-made text, for reminders that are not about a list's date (the menu of the day). */
	text?: { title: string; body: string };
}

export function isEventDate(value: string | null | undefined): value is string {
	const parts = (value ?? '').match(EVENT_DATE);
	if (!parts) return false;

	const [, year, month, day] = parts;
	const date = new Date(Number(year), Number(month) - 1, Number(day));

	// The constructor accepts "2026-02-31" by rolling it into March: we reject it by reading it back.
	return (
		date.getFullYear() === Number(year) &&
		date.getMonth() === Number(month) - 1 &&
		date.getDate() === Number(day)
	);
}

/**
 * The moment of the reminder, in the device timezone.
 *
 * Deliberately local and not UTC: "14 February" is a day as lived, and a reminder scheduled in UTC would
 * ring at an hour that makes sense nowhere. Nothing is returned when the moment has already passed —
 * scheduling a notification in the past does nothing at all, and the interface must be able to say so
 * instead of promising a reminder that will not come.
 */
export function reminderAt(eventDate: string | null | undefined, now: Date): Date | null {
	if (!isEventDate(eventDate)) return null;

	const [year, month, day] = eventDate.split('-').map(Number);
	const at = new Date(year, month - 1, day - REMINDER_DAYS_BEFORE, REMINDER_HOUR, 0, 0, 0);

	return at.getTime() > now.getTime() ? at : null;
}

/**
 * A stable integer for a list.
 *
 * Local notifications are identified by a 32-bit integer, not by a UUID. Making it stable is what allows
 * rescheduling without duplicates: the same list always falls on the same number, whether its date has
 * just changed or the application has been reinstalled.
 */
export function reminderId(listId: string): number {
	let hash = 0;
	for (const character of listId) hash = (hash * 31 + character.charCodeAt(0)) | 0;

	// The sign is removed: the Android implementation refuses a negative id.
	return Math.abs(hash) % 2147483647;
}

/**
 * The reminders the device must carry, now.
 *
 * This function answers at once "what if the date passes", "what if the list is finished", "what if the
 * date changes": it is replayed in full on every change, and what it no longer returns is cancelled. An
 * empty list keeps its reminder — it is precisely the one not filled in yet, and that is the case the
 * outcome describes.
 */
export function reminderPlans(candidates: ReminderCandidate[], now: Date): ReminderPlan[] {
	const plans: ReminderPlan[] = [];

	for (const candidate of candidates) {
		const at = reminderAt(candidate.eventDate, now);
		if (!at) continue;

		// Everything is picked up: the reminder has nothing left to remind about.
		if (candidate.total > 0 && candidate.done === candidate.total) continue;

		plans.push({
			listId: candidate.listId,
			id: reminderId(candidate.listId),
			name: candidate.name,
			eventDate: candidate.eventDate as string,
			at
		});
	}

	return plans;
}

/**
 * What the interface is allowed to announce about a date just typed.
 *
 * `late` is the honest case and the easy one to forget: the date is valid, it is even still ahead of us,
 * but the evening before has already passed. No reminder will fire, and it is better to write that than
 * to let the opposite be believed.
 */
export type ReminderStatus = 'none' | 'invalid' | 'late' | 'planned';

export function reminderStatus(
	eventDate: string | null | undefined,
	now: Date
): { status: ReminderStatus; at: Date | null } {
	if (!eventDate) return { status: 'none', at: null };
	if (!isEventDate(eventDate)) return { status: 'invalid', at: null };

	const at = reminderAt(eventDate, now);
	return at ? { status: 'planned', at } : { status: 'late', at: null };
}

/** The menu of the day is announced at breakfast time, in the device timezone. */
export const MENU_REMINDER_HOUR = 8;
export const MENU_REMINDER_DAYS = 7;

export interface MenuEntry {
	planId: string;
	planName: string;
	/** 0 is Monday, as in the meal plan screen. */
	dayIndex: number;
	recipeName: string;
}

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * One reminder per day that has something planned, for the coming week: "Today: pasta, salad". Like the
 * list reminders it is computed whole and replayed on every change, so a recipe moved to another day or
 * removed simply stops being returned. A day whose hour has already gone by is left out.
 */
export function menuReminderPlans(
	entries: readonly MenuEntry[],
	now: Date,
	title: (planName: string) => string
): ReminderPlan[] {
	const plans: ReminderPlan[] = [];

	for (let offset = 0; offset < MENU_REMINDER_DAYS; offset++) {
		const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, MENU_REMINDER_HOUR, 0, 0, 0);
		if (day.getTime() <= now.getTime()) continue;

		const weekday = (day.getDay() + 6) % 7;
		const todays = entries.filter(entry => entry.dayIndex === weekday);

		for (const planId of new Set(todays.map(entry => entry.planId))) {
			const ofPlan = todays.filter(entry => entry.planId === planId);
			const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;

			plans.push({
				listId: planId,
				id: reminderId(`menu:${planId}:${date}`),
				name: ofPlan[0].planName,
				eventDate: date,
				at: day,
				text: { title: title(ofPlan[0].planName), body: ofPlan.map(entry => entry.recipeName).join(', ') }
			});
		}
	}

	return plans;
}
