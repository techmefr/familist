import { describe, expect, it } from 'vitest';
import { lastUsedFor } from './item-defaults';

describe('lastUsedFor', () => {
	it('returns null when the product was never added before', () => {
		expect(lastUsedFor([], 'Milk')).toBeNull();
	});

	it('returns the unit and aisle of the most recent matching entry', () => {
		const history = [
			{ name: 'Milk', unit: 'l', aisleId: 'dairy', createdAt: 1 },
			{ name: 'Milk', unit: 'bottle', aisleId: 'fridge', createdAt: 100 }
		];

		expect(lastUsedFor(history, 'Milk')).toEqual({ unit: 'bottle', aisleId: 'fridge' });
	});

	it('matches by slug, ignoring case and accents', () => {
		const history = [{ name: 'Lait', unit: 'l', aisleId: 'dairy', createdAt: 1 }];

		expect(lastUsedFor(history, 'lait ')).toEqual({ unit: 'l', aisleId: 'dairy' });
	});

	it('ignores entries with no aisle recorded', () => {
		const history = [
			{ name: 'Bread', unit: 'piece', aisleId: '', createdAt: 5 },
			{ name: 'Bread', unit: 'bag', aisleId: 'bakery', createdAt: 1 }
		];

		expect(lastUsedFor(history, 'Bread')).toEqual({ unit: 'bag', aisleId: 'bakery' });
	});

	it('ignores entries for a different product', () => {
		const history = [{ name: 'Eggs', unit: 'tray', aisleId: 'dairy', createdAt: 1 }];

		expect(lastUsedFor(history, 'Milk')).toBeNull();
	});
});
