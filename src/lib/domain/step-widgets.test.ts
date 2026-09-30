import { describe, expect, it } from 'vitest';
import { parseWidgets, sanitizeStepWidgets, widgetsOfStep } from './step-widgets';

describe('parseWidgets', () => {
	it('keeps well-formed widgets and drops everything else', () => {
		const parsed = parseWidgets([
			{ type: 'appliance', appliance: 'oven', temperature: 180.4, setting: ' fan ' },
			{ type: 'alert', text: 'Hot pan' },
			{ type: 'wait', seconds: 7200, label: 'Rest' },
			{ type: 'photo', caption: 'Golden' },
			{ type: 'appliance', appliance: 'laser' },
			{ type: 'alert', text: '   ' },
			{ type: 'wait', seconds: -5 },
			{ type: 'nope' },
			null,
			'text'
		]);

		expect(parsed).toEqual([
			{ type: 'appliance', appliance: 'oven', temperature: 180, setting: 'fan', toVerify: undefined },
			{ type: 'alert', text: 'Hot pan' },
			{ type: 'wait', seconds: 7200, label: 'Rest', toVerify: undefined },
			{ type: 'photo', path: undefined, caption: 'Golden' }
		]);
	});

	it('refuses an absurd temperature instead of inventing one', () => {
		const [widget] = parseWidgets([{ type: 'appliance', appliance: 'oven', temperature: 9000 }]);
		expect(widget).toMatchObject({ type: 'appliance', temperature: undefined });
	});

	it('keeps the to-verify flag only when it is exactly true', () => {
		const [a, b] = parseWidgets([
			{ type: 'wait', seconds: 600, toVerify: true },
			{ type: 'wait', seconds: 600, toVerify: 'yes' }
		]);
		expect(a).toMatchObject({ toVerify: true });
		expect(b).toMatchObject({ toVerify: undefined });
	});

	it('caps the number of widgets on a step', () => {
		const many = Array.from({ length: 20 }, () => ({ type: 'alert', text: 'x' }));
		expect(parseWidgets(many)).toHaveLength(6);
	});

	it('reads anything that is not a list as no widgets', () => {
		expect(parseWidgets(undefined)).toEqual([]);
		expect(parseWidgets({})).toEqual([]);
	});
});

describe('sanitizeStepWidgets', () => {
	it('pads or cuts to the number of steps', () => {
		const out = sanitizeStepWidgets([[{ type: 'alert', text: 'a' }]], 3);
		expect(out).toHaveLength(3);
		expect(out[1]).toEqual([]);
	});
});

describe('widgetsOfStep', () => {
	it('puts the timer and the linked ingredients before the stored widgets', () => {
		const unified = widgetsOfStep({
			durationSeconds: 600,
			ingredientIds: ['a'],
			widgets: [{ type: 'alert', text: 'Careful' }]
		});
		expect(unified.map(widget => widget.type)).toEqual(['timer', 'ingredients', 'alert']);
	});

	it('shows nothing for a plain step', () => {
		expect(widgetsOfStep({})).toEqual([]);
	});
});
