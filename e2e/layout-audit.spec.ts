import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * The layout audit of #409, automated: every main screen at several viewports, at the default and the largest
 * text size, left to right and right to left. It looks for what a person would see as broken and a machine can
 * measure: horizontal scroll, content pushed outside the viewport, and primary controls too small to tap.
 *
 * Findings are listed in the test output (and as annotations) and only fail the run when
 * E2E_STRICT_LAYOUT=1, so the audit can report on a screen without blocking unrelated work. The check for
 * horizontal scroll is the one kept strict: a page that scrolls sideways is always a bug.
 */
const VIEWPORTS = [
	{ name: 'phone-small', width: 360, height: 740 },
	{ name: 'phone', width: 390, height: 844 },
	{ name: 'tablet-portrait', width: 768, height: 1024 },
	{ name: 'desktop', width: 1280, height: 800 }
];

const SCREENS = ['/', '/chat', '/cards', '/recipes', '/meal-plan', '/household', '/profile', '/profile/display', '/profile/notifications'];

const TEXT_SIZES = ['sm', 'comfort'];
const MIN_TAP = 44;
const TOLERANCE = 1;

interface Finding {
	screen: string;
	what: string;
}

async function measure(page: Page): Promise<Finding[]> {
	return page.evaluate(
		({ minTap, tolerance }) => {
			const found: { what: string }[] = [];
			const root = document.documentElement;

			if (root.scrollWidth > window.innerWidth + tolerance) {
				found.push({ what: `horizontal scroll: ${root.scrollWidth}px content in ${window.innerWidth}px` });
			}

			const interactive = document.querySelectorAll<HTMLElement>('button, a[href], [role="button"], input:not([type="hidden"]), select');
			for (const element of interactive) {
				const box = element.getBoundingClientRect();
				if (box.width === 0 || box.height === 0) continue;
				const style = getComputedStyle(element);
				if (style.visibility === 'hidden' || style.display === 'none') continue;
				if (element.closest('[inert], [aria-hidden="true"], .sr-only')) continue;
				if (element.matches('input[type="checkbox"], input[type="radio"]')) continue;

				const isOutside = box.right > window.innerWidth + tolerance || box.left < -tolerance;
				if (isOutside && !element.closest('[style*="overflow"], .overflow-x-auto')) {
					const name = element.getAttribute('data-test-id') ?? element.textContent?.trim().slice(0, 30) ?? element.tagName;
					found.push({ what: `outside the viewport: ${name}` });
				}

				if ((box.height < minTap - 4 || box.width < minTap - 4) && element.matches('button, [role="button"]')) {
					const name = element.getAttribute('data-test-id') ?? element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 30) ?? element.tagName;
					found.push({ what: `tap target ${Math.round(box.width)}x${Math.round(box.height)}: ${name}` });
				}
			}

			return found;
		},
		{ minTap: MIN_TAP, tolerance: TOLERANCE }
	).then(list => list.map(item => ({ screen: page.url(), ...item })));
}

for (const viewport of VIEWPORTS) {
	for (const size of TEXT_SIZES) {
		// Right to left on the phone only: the mirrored layout is the same code at every width.
		for (const direction of (viewport.name === 'phone' ? ['ltr', 'rtl'] : ['ltr']) as ('ltr' | 'rtl')[]) {
			test(`mise en page : ${viewport.name}, texte ${size}, ${direction}`, async ({ signedInPage: page }, testInfo) => {
				test.setTimeout(120_000);
				await page.setViewportSize({ width: viewport.width, height: viewport.height });

				const findings: Finding[] = [];

				for (const screen of SCREENS) {
					await page.goto(screen);
					await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
					await page.waitForLoadState('networkidle');
					await page.evaluate(
						({ scale, dir }) => {
							document.documentElement.dataset.scale = scale;
							document.documentElement.dir = dir;
						},
						{ scale: size, dir: direction }
					);
					await page.waitForTimeout(250);

					findings.push(...(await measure(page)));
				}

				const unique = [...new Map(findings.map(f => [`${f.screen}|${f.what}`, f])).values()];
				for (const finding of unique) {
					testInfo.annotations.push({ type: 'layout', description: `${finding.screen} ${finding.what}` });
					console.log(`LAYOUT ${viewport.name}/${size}/${direction} ${finding.screen} ${finding.what}`);
				}

				const sideways = unique.filter(f => f.what.startsWith('horizontal scroll'));
				expect(sideways, 'a screen scrolls sideways').toEqual([]);

				if (process.env.E2E_STRICT_LAYOUT === '1') expect(unique).toEqual([]);
			});
		}
	}
}
