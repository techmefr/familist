/**
 * Typed widgets attached to a recipe step (#472).
 *
 * A step is text plus what you need at that moment: a timer, the oven setting, the ingredients to get out,
 * a warning, a long wait, a photo. Two of those already have a home on the step and keep it, so there is one
 * source of truth for each: the timer is `durationSeconds` and the linked ingredients are `ingredientIds`.
 * `widgets` carries the four that had none. `widgetsOfStep` gives the unified view a screen wants.
 *
 * What comes back from storage, the database or an AI is never trusted: `parseWidgets` keeps only entries it
 * fully understands, drops the rest, and caps the count.
 */
export const APPLIANCES = ['oven', 'hob', 'microwave', 'airfryer', 'pressure', 'other'] as const;
export type Appliance = (typeof APPLIANCES)[number];

export interface ApplianceWidget {
	type: 'appliance';
	appliance: Appliance;
	/** Degrees Celsius. */
	temperature?: number;
	/** Free text: "fan", "grill", "medium heat". */
	setting?: string;
	/** Set by the AI import for a value it read but is not sure of; cleared when the person confirms. */
	toVerify?: boolean;
}

export interface AlertWidget {
	type: 'alert';
	text: string;
}

export interface WaitWidget {
	type: 'wait';
	/** A rest or marinade that runs long: hours, not a countdown to stand next to. */
	seconds: number;
	label?: string;
	toVerify?: boolean;
}

export interface PhotoWidget {
	type: 'photo';
	/** Storage path of the image; absent while only a caption was written. */
	path?: string;
	caption?: string;
}

export type StepWidget = ApplianceWidget | AlertWidget | WaitWidget | PhotoWidget;
export type StepWidgetType = StepWidget['type'];

export const STEP_WIDGET_TYPES: StepWidgetType[] = ['appliance', 'alert', 'wait', 'photo'];

export const MAX_WIDGETS_PER_STEP = 6;
export const MAX_TEMPERATURE = 500;
export const MAX_WAIT_SECONDS = 7 * 24 * 3600;
const MAX_TEXT = 200;

const isAppliance = (value: unknown): value is Appliance =>
	typeof value === 'string' && (APPLIANCES as readonly string[]).includes(value);

const cleanText = (value: unknown): string | undefined => {
	if (typeof value !== 'string') return undefined;
	const text = value.trim().slice(0, MAX_TEXT);
	return text || undefined;
};

function parseWidget(raw: unknown): StepWidget | null {
	if (!raw || typeof raw !== 'object') return null;
	const value = raw as Record<string, unknown>;

	switch (value.type) {
		case 'appliance': {
			if (!isAppliance(value.appliance)) return null;
			const temperature =
				typeof value.temperature === 'number' &&
				Number.isFinite(value.temperature) &&
				value.temperature > 0 &&
				value.temperature <= MAX_TEMPERATURE
					? Math.round(value.temperature)
					: undefined;
			return {
				type: 'appliance',
				appliance: value.appliance,
				temperature,
				setting: cleanText(value.setting),
				toVerify: value.toVerify === true ? true : undefined
			};
		}
		case 'alert': {
			const text = cleanText(value.text);
			return text ? { type: 'alert', text } : null;
		}
		case 'wait': {
			if (typeof value.seconds !== 'number' || !Number.isFinite(value.seconds)) return null;
			if (value.seconds <= 0 || value.seconds > MAX_WAIT_SECONDS) return null;
			return {
				type: 'wait',
				seconds: Math.round(value.seconds),
				label: cleanText(value.label),
				toVerify: value.toVerify === true ? true : undefined
			};
		}
		case 'photo': {
			const path = cleanText(value.path);
			const caption = cleanText(value.caption);
			return path || caption ? { type: 'photo', path, caption } : null;
		}
		default:
			return null;
	}
}

export function parseWidgets(raw: unknown): StepWidget[] {
	if (!Array.isArray(raw)) return [];

	return raw
		.map(parseWidget)
		.filter((widget): widget is StepWidget => widget !== null)
		.slice(0, MAX_WIDGETS_PER_STEP);
}

/** One entry per step, padded or cut to the number of steps, each cleaned. */
export function sanitizeStepWidgets(raw: unknown, stepCount: number): StepWidget[][] {
	const source = Array.isArray(raw) ? raw : [];
	return Array.from({ length: stepCount }, (_, index) => parseWidgets(source[index]));
}

export function emptyWidget(type: StepWidgetType): StepWidget {
	switch (type) {
		case 'appliance':
			return { type: 'appliance', appliance: 'oven', temperature: 180 };
		case 'alert':
			return { type: 'alert', text: '' };
		case 'wait':
			return { type: 'wait', seconds: 3600 };
		case 'photo':
			return { type: 'photo', caption: '' };
	}
}

/** An entry a form may hold while it is being typed is kept only once it says something. */
export const isMeaningful = (widget: StepWidget): boolean => parseWidget(widget) !== null;

export interface StepWithWidgets {
	durationSeconds?: number;
	ingredientIds?: string[];
	widgets?: StepWidget[];
}

export type UnifiedWidget =
	| { type: 'timer'; seconds: number }
	| { type: 'ingredients'; ingredientIds: string[] }
	| StepWidget;

/** The step's widgets as a screen lists them: timer first, then ingredients, then the stored ones. */
export function widgetsOfStep(step: StepWithWidgets): UnifiedWidget[] {
	const unified: UnifiedWidget[] = [];
	if (step.durationSeconds && step.durationSeconds > 0) {
		unified.push({ type: 'timer', seconds: step.durationSeconds });
	}
	if (step.ingredientIds && step.ingredientIds.length > 0) {
		unified.push({ type: 'ingredients', ingredientIds: step.ingredientIds });
	}
	return [...unified, ...parseWidgets(step.widgets)];
}
