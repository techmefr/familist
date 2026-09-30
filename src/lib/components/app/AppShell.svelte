<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { Plus, Search, User } from '@lucide/svelte';
	import { t } from '$i18n/index.svelte';
	import { session } from '$stores/session.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { settings } from '$stores/settings.svelte';
	import { PRICE_HISTORY_ENABLED } from '$domain/feature-flags';
	import SyncStatus from '$components/app/SyncStatus.svelte';
	import SyncRejections from '$components/app/SyncRejections.svelte';
	import InstallBanner from '$components/app/InstallBanner.svelte';
	import Logo from '$components/app/Logo.svelte';
	import HelpButton from '$components/app/HelpButton.svelte';
	import ListPanel from '$components/app/ListPanel.svelte';
	import ReportPanel from '$components/app/ReportPanel.svelte';
	import { NAV } from './nav-entries';

	let {
		children,
		onCreate,
		onSearch
	}: { children: Snippet; onCreate: () => void; onSearch: () => void } = $props();

	/**
	 * The signed-in frame, in four layers from the bottom up:
	 *
	 * 1. the app bar (`<nav>`): the destinations and nothing else;
	 * 2. the action bar: the page's own `SearchFilterBar` and the create button, floating above the app bar
	 *    and outside it, on the side of the hand that holds the device;
	 * 3. the content, which scrolls under both with room left at the bottom for them;
	 * 4. the header, sticky and hidden while scrolling down.
	 *
	 * Pages only provide their content and, if they search, a `SearchFilterBar`; the frame owns where
	 * everything sits, so a new screen cannot drift from the others.
	 */

	/**
	 * The measured height of the navigation element, published as a CSS variable.
	 *
	 * A page's floating controls — a list's filters — must sit just above the bottom bar. That height is
	 * not a constant: the bar grows with the text size and with the device notch, and a hard-coded value
	 * would put the button underneath from the first size step.
	 *
	 * It is deliberately a raw measurement and not `--fl-navbar-h`: in the other two regimes the
	 * navigation is a column as tall as the screen, and publishing its height under that name would make
	 * the floating controls believe a 900px floor blocks the bottom of the page. The stylesheet decides
	 * where the measurement counts.
	 */
	let navbarH = $state(0);

	/** The logo block that tops the full column: the create button sits right under it. */
	let logoH = $state(0);

	/**
	 * Hides the header while scrolling down past the first screenful, gives it back on the way up — the
	 * direction is what matters, not the absolute position, so a person scrolling back to check something
	 * gets it back immediately instead of having to reach the very top first. Below `headerHideAt` it always
	 * stays put: hiding it right as the page starts would flicker on the smallest scroll.
	 */
	const headerHideAt = 96;
	let headerHidden = $state(false);

	onMount(() => {
		if (!browser) return;
		let lastY = window.scrollY;

		function onScroll() {
			const y = window.scrollY;
			if (y <= headerHideAt) {
				headerHidden = false;
			} else if (y > lastY) {
				headerHidden = true;
			} else if (y < lastY) {
				headerHidden = false;
			}
			lastY = y;
		}

		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});

	/** Accounts only show for those who can manage them; price history stays hidden while unfinished (#362). */
	const entries = $derived(
		NAV.filter(
			(entry) =>
				(!('admin' in entry) || session.isAdmin) &&
				(entry.href !== '/prices' || PRICE_HISTORY_ENABLED)
		)
	);

	const isActive = (href: string) =>
		href === '/'
			? page.url.pathname === '/' || page.url.pathname.startsWith('/l/')
			: page.url.pathname.startsWith(href);

	/**
	 * Icons-only tabs, on a phone, at the three largest text sizes.
	 *
	 * Five labels fit under their icon up to `lg`; past that a two-line label pushes its neighbours and
	 * the bar's five tabs stop lining up under the thumb — the same crowding that already forces
	 * `.name-form` to a single column at these sizes (see app.css). The label is not removed, only made
	 * `sr-only`: a screen reader still gets it, and every page carries an `<h1>` that names where the icon
	 * led, so nothing that was said out loud goes missing.
	 */
	const iconOnlyNav = $derived(['xl', 'xxl', 'comfort'].includes(settings.fontScaleId));

	/** The magnifier takes the whole screen: the header keeps only help and the profile there. */
	const isMagnifier = $derived(page.url.pathname.startsWith('/magnifier'));

	/**
	 * The magnifier takes the whole surface to enlarge a label: nothing floats over it.
	 *
	 * A conversation hides it too (#365): its own compose button sits exactly where the floating one would,
	 * and the two used to overlap. The profile list hides it too (#412): it has no create action of its
	 * own, and the button floated over the settings rows underneath — only the list itself, not its
	 * sub-pages, one of which (the hand setting) is tested against the button staying put.
	 */
	const hidesCreate = $derived(
		page.url.pathname.startsWith('/magnifier') ||
			page.url.pathname.startsWith('/chat/d/') ||
			/^\/l\/[^/]+\/chat/.test(page.url.pathname) ||
			page.url.pathname === '/profile'
	);
</script>

	<div class="fl-shell" style="--fl-navbar-measured: {navbarH}px; --fl-logo-h: {logoH}px">
		<nav
			bind:clientHeight={navbarH}
			class="fl-navbar bg-card fixed inset-x-0 bottom-0 z-10 border-t"
			style="view-transition-name: nav"
			aria-label={t('nav.main')}
		>
			<!-- The household name does not fit in a 5.5rem rail: in portrait it stays in the header. -->
			<p
				bind:clientHeight={logoH}
				class="text-h2 hidden min-w-0 items-center gap-2.5 px-6 py-6 font-semibold full:flex"
			>
				<Logo />
				<span class="min-w-0 shrink truncate">{t('app.name')}</span>
			</p>

			<ul class="flex overflow-x-auto md:gap-1 md:px-3">
				{#each entries as { href, key, icon: Icon, place } (href)}
					{@const active = isActive(href)}
					<li
						class="min-w-0 flex-1 md:flex-none"
						class:full:hidden={place === 'handheld'}
						class:compact:hidden={place === 'desktop'}
						class:phone:hidden={place === 'tablet-and-desktop'}
					>
						<a
							{href}
							data-test-id="nav-{href}"
							aria-current={active ? 'page' : undefined}
							class="fl-press text-caption full:text-label relative flex flex-col items-center gap-1 px-2 py-2 full:flex-row full:gap-3 full:rounded-md full:px-3 full:py-3
								{active ? 'text-primary' : 'text-muted-foreground'}"
						>
							<!--
								The active tab badge is a separate element, named for the transition: it slides from one tab
								to the next during the page change. Naming the whole link would slide its text, which would
								blend into the next tab's.

								Its shape is in app.css: a pill behind the icon on a phone, a full line in the column. The
								wrapper decides, by ceasing to be its containing block beyond 48rem.
							-->
							<span class="fl-nav-icon">
								{#if active}
									<span
										class="fl-nav-pill"
										style="view-transition-name: nav-active"
										aria-hidden="true"
									></span>
								{/if}
								<Icon size={22} class="relative" aria-hidden="true" />
							</span>
							<!-- The weight repeats the active tab: colour must not say it on its own. -->
							<span
								class="fl-nav-label relative w-full text-center [hyphens:auto] [overflow-wrap:break-word] {active
									? 'font-medium'
									: ''} {iconOnlyNav ? 'phone:sr-only' : ''}"
								>{t(key)}</span
							>
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<!--
			The create button, outside the app bar: the bar holds destinations, this is an action. On a phone it
			is a solid disc floating above the bar, on the side of the hand holding the device (`fl-thumb-side`).
			From 48rem on the bar is a column and the button sits at the top of it, under the logo in the full
			column, where it has always been; the stylesheet places it (`.fl-create`).

			It disappears on the magnifier, and only on a phone: there the disc floats over the label you are
			trying to read. One element for every size: two buttons would carry the same test marker, and the
			guided tour would end up pointing at an invisible one.
		-->
		<button
			type="button"
			onclick={() => {
				feedback.play('tap');
				onCreate();
			}}
			data-test-id="nav-create"
			aria-haspopup="dialog"
			class="fl-press fl-create fl-thumb-side bg-primary text-primary-foreground shadow-fl-3 flex items-center justify-center gap-0 rounded-full
				full:justify-start full:gap-3
				{hidesCreate ? 'phone:hidden' : ''}"
		>
			<Plus size={26} aria-hidden="true" />
			<span class="text-label sr-only font-medium full:not-sr-only">{t('nav.create')}</span>
		</button>

		<ListPanel />

		<div>
			<SyncStatus />
			<SyncRejections />
			<InstallBanner />

			<!--
				The header. Help is in the same place on every screen and at every size: looking for the question
				mark somewhere else depending on the page would cost more time than it saves.

				Everywhere the navigation only shows the daily destinations — phone and tablet in portrait — it
				also carries what the full column shows by itself: the logo and the name, which say where you are,
				and the profile. A setting is looked for at the top of the screen; a round trip is made with the
				thumb, on the edge.
			-->
			<header
				inert={headerHidden}
				class="bg-background sticky top-0 z-10 mx-auto flex w-full max-w-5xl flex-wrap items-center
					justify-between gap-x-4 gap-y-1 px-4 pt-3 pb-1 transition-transform duration-200 ease-out
					{headerHidden ? '-translate-y-full' : 'translate-y-0'}"
			>
				<p class="text-h2 flex min-w-0 items-center gap-2 font-semibold full:hidden">
					<Logo />
					<span class="min-w-0 shrink truncate">{t('app.name')}</span>
				</p>

				<div class="ms-auto flex shrink-0 items-center gap-0.5">
					<!--
						Search is in the header, next to help, and in the same place at both screen sizes. It does not
						go in the bottom bar: that one carries destinations, one per tab, and search is not one — it
						opens a sheet over the page and gives it back afterwards. Adding a fifth tab on a phone would
						also have squeezed the other four below the finger threshold.
					-->
					{#if !isMagnifier}
					<button
						type="button"
						onclick={() => {
							feedback.play('tap');
							onSearch();
						}}
						data-test-id="header-search"
						aria-label={t('search.open')}
						aria-haspopup="dialog"
						class="fl-press text-muted-foreground hover:text-foreground flex size-[max(2.5rem,44px)] items-center justify-center rounded-full"
					>
						<Search size={22} aria-hidden="true" />
					</button>
					{/if}
					<HelpButton />
					<a
						href="/profile"
						data-test-id="header-profile"
						aria-label={t('nav.profile')}
						aria-current={isActive('/profile') ? 'page' : undefined}
						class="fl-press text-muted-foreground flex size-[max(2.5rem,44px)] items-center justify-center rounded-full full:hidden"
					>
						<User size={22} aria-hidden="true" />
					</a>
				</div>
			</header>

			<!--
				The bottom padding used to be a flat `pb-36`: close enough to clear the create button most of the
				time, but the button's own footprint — the navigation bar plus its 58 px disc and margin — is not
				a constant, it grows with the text size just like `--fl-navbar-h` does. A page whose last card
				landed right at that boundary (the avatar hint on `/profile`, the join button on `/household`, a
				busy poll's last option) ended up with it half hidden behind the disc. The formula mirrors
				`fl-above-nav`'s so the two amounts cannot drift apart.
			-->
			<main
				class="mx-auto w-full max-w-5xl px-4 pt-2 pb-[calc(var(--fl-navbar-h,4rem)+58px+1.5rem)] md:pb-10"
			>
				{@render children()}
			</main>
		</div>

		<!--
			The report panel is placed here, inside the grid, and not beside it: this element is what
			publishes `--fl-navbar-measured`, which the panel needs so as not to slip under the tabs. It lives
			outside the pages so it survives a navigation — you can go and reproduce the problem elsewhere, the
			draft follows.
		-->
		<ReportPanel />
	</div>

