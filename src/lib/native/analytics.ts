import { goatcounterSite } from '$db/supabase';

/**
 * Cookie-free audience counting (GoatCounter), on by default only for instances that set
 * `PUBLIC_GOATCOUNTER_SITE` at build time — every other deployment, including a family's own container,
 * sends nothing anywhere. GoatCounter stores no cookie and no personal data: only a page path, a referrer
 * and coarse browser/location info, none of it tied back to a person (see the privacy policy).
 *
 * The app is a single-page app, native and web alike, so the stock snippet (which only counts the very
 * first page load) would undercount everything after the first screen. `no_onload` turns that off, and
 * `count()` below is called by hand on every route change instead — GoatCounter's documented way to wire
 * it into an SPA.
 */

declare global {
	interface Window {
		goatcounter?: {
			no_onload?: boolean;
			count?: (options: { path: string }) => void;
		};
	}
}

let scriptLoading: Promise<void> | null = null;

function loadScript(site: string): Promise<void> {
	if (scriptLoading) return scriptLoading;

	scriptLoading = new Promise((resolve) => {
		window.goatcounter = { no_onload: true };

		const script = document.createElement('script');
		script.async = true;
		script.src = 'https://gc.zgo.at/count.js';
		script.dataset.goatcounter = `https://${site}.goatcounter.com/count`;
		// A blocked or unreachable script must never hold up the caller: resolving either way just means
		// the next `count()` call finds `window.goatcounter.count` missing and quietly does nothing.
		script.onload = () => resolve();
		script.onerror = () => resolve();
		document.head.appendChild(script);
	});

	return scriptLoading;
}

/** Records one page view. A no-op wherever `PUBLIC_GOATCOUNTER_SITE` was never set. */
export function trackPageview(path: string): void {
	if (typeof window === 'undefined' || !goatcounterSite) return;

	void loadScript(goatcounterSite).then(() => window.goatcounter?.count?.({ path }));
}
