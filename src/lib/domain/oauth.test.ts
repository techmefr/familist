import { describe, expect, it } from 'vitest';
import {
	OAUTH_PROVIDERS,
	enabledProviders,
	isProviderId,
	orderProviders,
	parseProviderList,
	type ProviderId
} from './oauth';

describe('parseProviderList', () => {
	it('reads a comma-separated list, in the operator’s order, without duplicates', () => {
		expect(parseProviderList('apple, google ,github,google')).toEqual(['apple', 'google', 'github']);
	});

	it('ignores unknown identifiers, case and emptiness', () => {
		expect(parseProviderList('Google,unknown,,APPLE')).toEqual(['google', 'apple']);
		expect(parseProviderList('')).toEqual([]);
		expect(parseProviderList(undefined)).toEqual([]);
		expect(parseProviderList(42)).toEqual([]);
	});
});

describe('enabledProviders', () => {
	it('rend rien quand aucun fournisseur n est configure', () => {
		expect(enabledProviders([])).toEqual([]);
		expect(enabledProviders()).toEqual([]);
	});

	it('suit l’ordre de la liste activee', () => {
		expect(enabledProviders(['azure', 'google']).map((provider) => provider.id)).toEqual([
			'azure',
			'google'
		]);
	});

	it('ignore un identifiant qui n est pas au catalogue', () => {
		expect(enabledProviders(['inconnu' as ProviderId])).toEqual([]);
	});
});

describe('the catalogue', () => {
	it('has unique identifiers and a brand label for each', () => {
		const ids = OAUTH_PROVIDERS.map((provider) => provider.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(OAUTH_PROVIDERS.every((provider) => provider.label.length > 0)).toBe(true);
		expect(ids.every(isProviderId)).toBe(true);
	});
});

describe('orderProviders', () => {
	const all = enabledProviders(['github', 'apple', 'facebook', 'google']);

	it('puts Google first on Android', () => {
		const { primary, others } = orderProviders(all, 'android');
		expect(primary?.id).toBe('google');
		expect(others.map((provider) => provider.id)).toEqual(['apple', 'github', 'facebook']);
	});

	it('puts Apple first on iOS', () => {
		expect(orderProviders(all, 'ios').primary?.id).toBe('apple');
	});

	it('puts Google then Apple on the web', () => {
		const { primary, others } = orderProviders(all, 'web');
		expect([primary?.id, others[0]?.id]).toEqual(['google', 'apple']);
	});

	it('falls back on the operator’s order when neither is enabled', () => {
		const { primary, others } = orderProviders(enabledProviders(['github', 'discord']), 'android');
		expect([primary?.id, others[0]?.id]).toEqual(['github', 'discord']);
	});

	it('has no primary and no More button with nothing enabled, and no More with a single one', () => {
		expect(orderProviders([], 'web')).toEqual({ primary: null, others: [] });
		expect(orderProviders(enabledProviders(['github']), 'ios').others).toEqual([]);
	});
});
