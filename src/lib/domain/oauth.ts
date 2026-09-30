/**
 * Signing in through an external provider. The code is complete for all four providers, but a button only
 * appears if its identifier is in ENABLED_PROVIDERS: Supabase answers "Unsupported provider" for a provider
 * not configured on its side, and a button that always fails is worse than no button at all.
 *
 * Enabling a provider takes two steps, in this order:
 *  1. create the OAuth application at the provider, then paste its identifier and secret into Supabase
 *     (Authentication > Sign In / Providers). The return URL to declare at the provider is
 *     https://<ref>.supabase.co/auth/v1/callback;
 *  2. add its identifier to ENABLED_PROVIDERS here, then redeploy.
 *
 * Microsoft is called "azure" on the Supabase side, which is its former product name.
 */
export type ProviderId =
	| 'google'
	| 'apple'
	| 'facebook'
	| 'azure'
	| 'github'
	| 'gitlab'
	| 'discord'
	| 'twitch'
	| 'linkedin_oidc'
	| 'slack_oidc'
	| 'twitter'
	| 'spotify'
	| 'notion'
	| 'bitbucket'
	| 'keycloak';

export interface OAuthProvider {
	id: ProviderId;
	/** Brand name, never translated: "Google" is written Google in every language. */
	label: string;
	/**
	 * Scopes requested on top of the default ones. Microsoft does not return the email address without
	 * email, and with no address the trigger creating the profile has nothing to name the person with.
	 */
	scopes?: string;
}

export const OAUTH_PROVIDERS: OAuthProvider[] = [
	{ id: 'google', label: 'Google' },
	{ id: 'apple', label: 'Apple' },
	{ id: 'facebook', label: 'Facebook' },
	{ id: 'azure', label: 'Microsoft', scopes: 'email' },
	{ id: 'github', label: 'GitHub' },
	{ id: 'gitlab', label: 'GitLab' },
	{ id: 'discord', label: 'Discord' },
	{ id: 'twitch', label: 'Twitch' },
	{ id: 'linkedin_oidc', label: 'LinkedIn' },
	{ id: 'slack_oidc', label: 'Slack' },
	{ id: 'twitter', label: 'X' },
	{ id: 'spotify', label: 'Spotify' },
	{ id: 'notion', label: 'Notion' },
	{ id: 'bitbucket', label: 'Bitbucket' },
	// Open source and self-hostable: an instance can run its own identity provider and offer only that.
	{ id: 'keycloak', label: 'Keycloak' }
];

export const PROVIDER_IDS: ProviderId[] = OAUTH_PROVIDERS.map((provider) => provider.id);

export const isProviderId = (value: unknown): value is ProviderId =>
	typeof value === 'string' && (PROVIDER_IDS as string[]).includes(value);

/**
 * The providers an instance offers, from its configuration (a comma-separated list of identifiers, in the
 * order the operator wrote them). Unknown identifiers are ignored and duplicates dropped: a typo must not
 * produce a button that always fails.
 */
export function parseProviderList(raw: unknown): ProviderId[] {
	if (typeof raw !== 'string') return [];
	const seen = new Set<ProviderId>();

	for (const part of raw.split(',')) {
		const id = part.trim().toLowerCase();
		if (isProviderId(id)) seen.add(id);
	}

	return [...seen];
}

export function enabledProviders(
	enabled: ProviderId[] = [],
	catalogue: OAuthProvider[] = OAUTH_PROVIDERS
): OAuthProvider[] {
	// The operator's order wins over the catalogue's: the list they wrote is the list they want shown.
	return enabled.flatMap((id) => catalogue.filter((provider) => provider.id === id));
}

export type Platform = 'android' | 'ios' | 'web';

/**
 * The one button shown first, and the rest behind "More". The platform's own account comes first where it
 * exists: Google on Android, Apple on iOS (which App Store review requires next to any other social login).
 * On the web, Google then Apple, then the operator's order. Only what is enabled can be first.
 */
export function orderProviders(
	providers: OAuthProvider[],
	platform: Platform
): { primary: OAuthProvider | null; others: OAuthProvider[] } {
	const preferred: ProviderId[] =
		platform === 'ios' ? ['apple', 'google'] : ['google', 'apple'];

	const rank = (provider: OAuthProvider) => {
		const index = preferred.indexOf(provider.id);
		return index === -1 ? preferred.length : index;
	};

	const sorted = providers
		.map((provider, position) => ({ provider, position }))
		.toSorted((a, b) => rank(a.provider) - rank(b.provider) || a.position - b.position)
		.map((entry) => entry.provider);

	return { primary: sorted[0] ?? null, others: sorted.slice(1) };
}
