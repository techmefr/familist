import { describe, expect, it } from 'vitest';
import {
	DEFAULT_UNIT,
	formatAmount,
	UNIT_GROUPS,
	UNITS,
	resolveUnit,
	unitGroupOf,
	unitKey,
	unitKeyForCount,
	unitsOf
} from './units';

describe('resolveUnit', () => {
	it('reconnait un identifiant tel quel', () => {
		expect(resolveUnit('kg')).toBe('kg');
	});

	it('reconnait ce qui a ete saisi a la main avant la liste', () => {
		expect(resolveUnit('pièce')).toBe('piece');
		expect(resolveUnit('boîte')).toBe('box');
		expect(resolveUnit('rouleaux')).toBe('roll');
	});

	it('reconnait aussi ce qui a ete saisi en anglais', () => {
		expect(resolveUnit('bottles')).toBe('bottle');
		expect(resolveUnit('grams')).toBe('g');
		expect(resolveUnit('items')).toBe('piece');
	});

	it('ignore la casse et les espaces autour', () => {
		expect(resolveUnit('  Litres ')).toBe('l');
	});

	it('rend null sur une valeur vide ou inconnue', () => {
		expect(resolveUnit('')).toBeNull();
		expect(resolveUnit('   ')).toBeNull();
		expect(resolveUnit(null)).toBeNull();
		expect(resolveUnit('douzaine')).toBeNull();
	});

	it('ne rapproche pas deux unites de volumes differents', () => {
		// 50 cl brought back to 50 ml would be ten times less with nobody seeing it.
		expect(resolveUnit('cl')).toBeNull();
	});

	it('propose une unite par defaut qui est bien de la liste', () => {
		expect(UNITS).toContain(DEFAULT_UNIT);
	});
});

describe('unitKey', () => {
	it('prefixe la clef de traduction', () => {
		expect(unitKey('paquet')).toBe('units.pack');
	});

	it('rend null pour laisser afficher le texte d origine', () => {
		expect(unitKey('douzaine')).toBeNull();
	});
});

describe('UNIT_GROUPS', () => {
	it('range chaque unité dans une famille et une seule', () => {
		const rows = UNIT_GROUPS.flatMap((group) => group.units as readonly string[]);

		expect([...rows].sort()).toEqual([...UNITS].sort());
		expect(new Set(rows).size).toBe(rows.length);
	});

	// Ten pack sizes is already a lot to read at once; beyond that, the family splits.
	it('ne propose jamais plus de dix choix à la fois', () => {
		for (const group of UNIT_GROUPS) expect(group.units.length).toBeLessThanOrEqual(10);
	});
});

describe('unitGroupOf', () => {
	it('retrouve la famille d’une unité connue', () => {
		expect(unitGroupOf('kg')).toBe('weight');
		expect(unitGroupOf('ml')).toBe('volume');
		expect(unitGroupOf('bottle')).toBe('pack');
		expect(unitGroupOf('piece')).toBe('count');
	});

	it('accepte ce qui a été saisi à la main', () => {
		expect(unitGroupOf('litres')).toBe('volume');
		expect(unitGroupOf('boîte')).toBe('pack');
	});

	// An item imported with a fanciful unit must stay editable.
	it('retombe sur les pièces plutôt que d’échouer', () => {
		expect(unitGroupOf('douzaine')).toBe('count');
		expect(unitGroupOf('')).toBe('count');
		expect(unitGroupOf(null)).toBe('count');
	});
});

describe('unitsOf', () => {
	it('rend les unités de la famille demandée', () => {
		expect(unitsOf('weight')).toEqual(['g', 'kg']);
		expect(unitsOf('count')).toEqual(['piece']);
	});

	it('rend toujours une rangée non vide', () => {
		for (const group of UNIT_GROUPS) expect(unitsOf(group.id).length).toBeGreaterThan(0);
	});
});

describe('unitKeyForCount', () => {
	it('accorde la pièce au pluriel au-delà de un', () => {
		expect(unitKeyForCount('piece', '1')).toBe('units.piece');
		expect(unitKeyForCount('piece', '3')).toBe('units.piecePlural');
		expect(unitKeyForCount('piece', '0.5')).toBe('units.piecePlural');
		expect(unitKeyForCount('piece', '0')).toBe('units.piecePlural');
	});

	it('laisse les autres unités invariables', () => {
		expect(unitKeyForCount('g', '3')).toBe('units.g');
		expect(unitKeyForCount('slice', '3')).toBe('units.slice');
	});

	it('rend null pour une unité inconnue', () => {
		expect(unitKeyForCount('douzaine', '3')).toBeNull();
	});
});

describe('formatAmount', () => {
	const say = (key: string) => key.replace('units.', '');

	it('never prints a unit without a quantity', () => {
		expect(formatAmount('', 'g', say)).toBeNull();
		expect(formatAmount('  ', 'g', say)).toBeNull();
		expect(formatAmount('0', 'g', say)).toBeNull();
		expect(formatAmount(null, 'ml', say)).toBeNull();
	});

	it('joins quantity and unit, and keeps a bare quantity', () => {
		expect(formatAmount('200', 'g', say)).toBe('200 g');
		expect(formatAmount('2', null, say)).toBe('2');
		expect(formatAmount('1,5', 'l', say)).toBe('1,5 l');
	});

	it('keeps an unknown unit as written', () => {
		expect(formatAmount('3', 'noisettes', say)).toBe('3 noisettes');
	});
});
