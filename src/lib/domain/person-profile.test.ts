import { describe, expect, it } from 'vitest';
import type { PersonProfile } from '$db/schema';
import { bySeverity, clampPortion, conflictsFor, emptyProfile, parseAllergies, stringList } from './person-profile';

const profile = (changes: Partial<PersonProfile>): PersonProfile => ({
	...emptyProfile('p1', 'h1', 'u1'),
	...changes
});

describe('parseAllergies', () => {
	it('keeps valid entries and drops unknown severities and blanks', () => {
		const out = parseAllergies([
			{ id: 'peanut', label: 'Peanut', severity: 'severe' },
			{ id: 'milk', label: 'Milk', severity: 'sometimes' },
			{ label: '  ', severity: 'severe' },
			{ label: 'Kiwi', severity: 'intolerance' },
			{ id: 'peanut', label: 'Peanut again', severity: 'severe' }
		]);

		expect(out.map(a => a.id)).toEqual(['peanut', 'kiwi']);
	});
});

describe('stringList and clampPortion', () => {
	it('trims, dedupes and caps', () => {
		expect(stringList([' a ', 'A', 'b', 3, ''])).toEqual(['a', 'b']);
	});

	it('keeps a portion factor in range', () => {
		expect(clampPortion(9)).toBe(3);
		expect(clampPortion(0)).toBe(0.25);
		expect(clampPortion(Number.NaN)).toBe(1);
	});
});

describe('conflictsFor', () => {
	const leo = {
		personId: 'p1',
		name: 'Léo',
		profile: profile({ allergies: [{ id: 'peanut', label: 'Peanut', severity: 'severe' }], diets: ['no-pork'] })
	};
	const mia = {
		personId: 'p2',
		name: 'Mia',
		profile: profile({ personId: 'p2', allergies: [{ id: 'kiwi', label: 'Kiwi', severity: 'intolerance' }] })
	};

	it('warns with the person and the reason, severest first', () => {
		const found = conflictsFor('kiwi and peanut butter and bacon', 'en', [mia, leo]);

		expect(found.map(c => [c.name, c.severity])).toEqual([
			['Léo', 'severe'],
			['Léo', 'severe'],
			['Mia', 'intolerance']
		]);
	});

	it('matches a custom allergy by its own label', () => {
		expect(conflictsFor('Kiwi smoothie', 'en', [mia])).toHaveLength(1);
	});

	it('says nothing for a person without a profile or a clean item', () => {
		expect(conflictsFor('peanut', 'en', [{ personId: 'x', name: 'Guest', profile: null }])).toEqual([]);
		expect(conflictsFor('apple', 'en', [leo, mia])).toEqual([]);
	});

	it('orders severities', () => {
		const sorted = bySeverity([
			{ id: 'a', label: 'a', severity: 'preference' },
			{ id: 'b', label: 'b', severity: 'severe' }
		]);
		expect(sorted[0].severity).toBe('severe');
	});
});

import { aiConstraints, capConstraints, MAX_CONSTRAINTS, MAX_CONSTRAINT_LENGTH } from './person-profile';

describe('aiConstraints', () => {
	it('writes allergies, diets and dislikes without any name', () => {
		const out = aiConstraints(
			profile({
				allergies: [
					{ id: 'peanut', label: 'Arachide', severity: 'severe' },
					{ id: 'kiwi', label: 'Kiwi', severity: 'preference' }
				],
				diets: ['halal'],
				dislikes: ['coriandre']
			})
		);

		expect(out).toEqual(['Arachide (peanut) severe', 'avoid Kiwi', 'halal', 'dislikes coriandre']);
	});

	it('bounds what leaves', () => {
		const many = Array.from({ length: 100 }, (_, n) => `x${n}`);
		expect(capConstraints(many)).toHaveLength(MAX_CONSTRAINTS);
		expect(capConstraints(['a'.repeat(500)])[0]).toHaveLength(MAX_CONSTRAINT_LENGTH);
		expect(capConstraints(['  ', ''])).toEqual([]);
	});
});

import { warningsFor } from './person-profile';

describe('warningsFor', () => {
	const own = [
		{ personId: 'p1', name: 'Léo', profile: profile({ allergies: [{ id: 'peanut', label: 'Peanut', severity: 'severe' }] }) }
	];

	it('adds what other members agreed to share, without a severity', () => {
		const out = warningsFor('pesto', 'en', own, [{ personId: 'p9', name: 'Zoé', allergens: ['Milk'], diets: [] }]);

		expect(out).toEqual([{ personId: 'p9', name: 'Zoé', what: 'Milk', kind: 'allergy', severity: null }]);
	});

	it('gives the owner their own severity', () => {
		const [warning] = warningsFor('peanut butter', 'en', own, []);
		expect(warning).toMatchObject({ name: 'Léo', what: 'Peanut', severity: 'severe' });
	});

	it('shares diets as rules', () => {
		const out = warningsFor('bacon', 'en', [], [{ personId: 'p9', name: 'Zoé', allergens: [], diets: ['halal'] }]);
		expect(out).toHaveLength(1);
	});
});

import { portionsFor } from './person-profile';

describe('portionsFor', () => {
	it('sums the portion factors and counts unknown profiles as one', () => {
		const eaters = [
			{ personId: 'a', name: 'A', profile: profile({ portionFactor: 1.5 }) },
			{ personId: 'b', name: 'B', profile: profile({ portionFactor: 0.5 }) },
			{ personId: 'c', name: 'C', profile: null }
		];
		expect(portionsFor(eaters)).toBe(3);
	});

	it('leaves the recipe alone with nobody on the roster', () => {
		expect(portionsFor([])).toBeNull();
	});
});

import { productWarnings } from './person-profile';

describe('productWarnings', () => {
	it('matches allergies by id and diets by the groups they exclude', () => {
		const eaters = [
			{ personId: 'p1', name: 'Léo', profile: profile({ allergies: [{ id: 'nuts', label: 'Nuts', severity: 'severe' }], diets: ['vegan'] }) }
		];
		const out = productWarnings(['milk', 'nuts'], eaters);

		expect(out.map(w => [w.kind, w.severity])).toEqual([
			['allergy', 'severe'],
			['diet', null]
		]);
		expect(productWarnings(['soy'], eaters)).toEqual([]);
	});
});
