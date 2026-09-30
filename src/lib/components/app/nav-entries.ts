import {
	ListChecks,
	Store,
	CreditCard,
	User,
	Glasses,
	MessagesSquare,
	Users,
	ShieldCheck,
	Tags,
	CookingPot,
	CalendarDays
} from '@lucide/svelte';

/**
 * One table for the three regimes, and a field saying where each entry belongs.
 *
 * Four regimes of destinations for three CSS regimes: the tablet in portrait mostly takes the phone's,
 * because the rail is a narrow column, it carries icons above a short word, not nine destinations — but
 * it has a hand free where the phone does not, so it can take one more than the phone.
 *
 * `handheld`: phone and tablet in portrait, that is, everything held in the hand. The magnifier uses
 * the rear camera in front of a product label — a tablet has one, a computer screen would have nothing
 * to show.
 *
 * `desktop`: the full column only. In a thumb bar as in a rail, five tabs are a maximum: beyond that,
 * the labels crowd and the targets fall below the finger threshold. So it holds the four daily
 * round trips — lists, magnifier, chats, cards. Shops drop out: the create button already adds an
 * aisle and a shop, and you only go to that screen to tidy up, not while shopping. The accounts and the
 * profile are destinations you visit rarely; outside the full column you reach them through the header
 * and the profile, in the column they get their tab like the rest.
 *
 * `tablet-and-desktop`: the rail and the full column, not the phone. The household — its members, diets,
 * the switcher between households — and the weekly meal plan are rarer stops than the four daily ones
 * but not as rare as the accounts or the profile settings, and unlike them they stay reachable from a
 * thumb: a tablet held with both hands can spare the extra icons, a phone held in one cannot. On the
 * phone they stay where they always were — the household tucked under the profile, the meal plan reached
 * from the recipes screen and the create menu.
 *
 * The magnifier comes second, against the lists: it is the tool you open in the aisle, one hand on the
 * trolley, and the edge of the thumb reaches it without crossing the bar.
 */
export const NAV = [
	{ href: '/', key: 'nav.lists', icon: ListChecks, place: 'partout' },
	{ href: '/magnifier', key: 'nav.magnifier', icon: Glasses, place: 'handheld' },
	{ href: '/chat', key: 'nav.chat', icon: MessagesSquare, place: 'partout' },
	{ href: '/cards', key: 'nav.cards', icon: CreditCard, place: 'partout' },
	{ href: '/recipes', key: 'nav.recipes', icon: CookingPot, place: 'partout' },
	{ href: '/shops', key: 'nav.shops', icon: Store, place: 'desktop' },
	{ href: '/prices', key: 'nav.prices', icon: Tags, place: 'desktop' },
	{ href: '/household', key: 'nav.household', icon: Users, place: 'tablet-and-desktop' },
	{ href: '/meal-plan', key: 'nav.mealPlan', icon: CalendarDays, place: 'tablet-and-desktop' },
	{ href: '/admin', key: 'nav.admin', icon: ShieldCheck, place: 'desktop', admin: true },
	{ href: '/profile', key: 'nav.profile', icon: User, place: 'desktop' }
] as const;
