import type { StandardAllergen } from './allergens';

/**
 * Reading a product from Open Food Facts (#491), the open database of food products (ODbL).
 *
 * The API answers in the product's own languages. Names and ingredients are read in the active language
 * first, then English, then whatever the product has; allergens come as normalised tags (`en:milk`) that do
 * not depend on any language, which is what lets them be mapped to our own standard allergens.
 */
export const OFF_ATTRIBUTION_URL = 'https://world.openfoodfacts.org';

const FIELDS = [
	'code',
	'product_name',
	'brands',
	'quantity',
	'image_front_small_url',
	'allergens_tags',
	'traces_tags',
	'labels_tags',
	'ingredients_text',
	'generic_name',
	'nutriscore_grade',
	'nova_group',
	'ecoscore_grade',
	'nutriments'
];

export function productUrl(ean: string, locale: string): string {
	const language = locale.split('-')[0];
	const localized = [`product_name_${language}`, `ingredients_text_${language}`, `generic_name_${language}`];
	const fields = [...FIELDS, ...localized].join(',');
	return `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json?fields=${fields}`;
}

/** The standard allergens behind Open Food Facts' tags. Tags we do not know are kept aside, never dropped. */
const TAG_TO_ALLERGEN: Record<string, StandardAllergen> = {
	'en:milk': 'milk',
	'en:eggs': 'egg',
	'en:peanuts': 'peanut',
	'en:nuts': 'nuts',
	'en:gluten': 'gluten',
	'en:fish': 'fish',
	'en:crustaceans': 'shellfish',
	'en:molluscs': 'shellfish',
	'en:soybeans': 'soy',
	'en:sesame-seeds': 'sesame',
	'en:mustard': 'mustard',
	'en:celery': 'celery'
};

export interface Product {
	ean: string;
	name: string;
	brand: string | null;
	quantity: string | null;
	ingredients: string | null;
	imageUrl: string | null;
	allergens: StandardAllergen[];
	traces: StandardAllergen[];
	/** Allergen tags we have no standard entry for (lupin, sulphites…), readable as `lupin`. */
	otherAllergens: string[];
	isVegan: boolean;
	isVegetarian: boolean;
	nutriScore: Grade | null;
	ecoScore: Grade | null;
	novaGroup: 1 | 2 | 3 | 4 | null;
	nutrition: Nutrition;
}

export type Grade = 'a' | 'b' | 'c' | 'd' | 'e';

/** Per 100 g (or 100 ml); each value is null when the product does not declare it. */
export interface Nutrition {
	energyKcal: number | null;
	fat: number | null;
	saturatedFat: number | null;
	sugars: number | null;
	salt: number | null;
}

const grade = (value: unknown): Grade | null =>
	typeof value === 'string' && /^[a-e]$/.test(value) ? (value as Grade) : null;

const novaGroup = (value: unknown): Product['novaGroup'] =>
	value === 1 || value === 2 || value === 3 || value === 4 ? value : null;

const amount = (source: Record<string, unknown>, key: string): number | null => {
	const value = source[`${key}_100g`];
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const text = (value: unknown): string | null => {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed === '' ? null : trimmed;
};

const tags = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : [];

function mapAllergens(list: string[]): { standard: StandardAllergen[]; other: string[] } {
	const standard = new Set<StandardAllergen>();
	const other = new Set<string>();

	for (const tag of list) {
		const known = TAG_TO_ALLERGEN[tag];
		if (known) standard.add(known);
		else other.add(tag.replace(/^[a-z]{2}:/, '').replaceAll('-', ' '));
	}

	return { standard: [...standard], other: [...other] };
}

/** The product in a response, or null when the barcode is unknown or the answer is not a product. */
export function parseProduct(raw: unknown, locale: string): Product | null {
	if (!raw || typeof raw !== 'object') return null;
	const root = raw as Record<string, unknown>;
	if (root.status === 0 || !root.product || typeof root.product !== 'object') return null;

	const product = root.product as Record<string, unknown>;
	const language = locale.split('-')[0];
	const pick = (base: string): string | null =>
		text(product[`${base}_${language}`]) ?? text(product[`${base}_en`]) ?? text(product[base]);

	const brand = text(product.brands)?.split(',')[0].trim() ?? null;
	const ean = text(root.code) ?? text(product.code);
	const name = pick('product_name') ?? pick('generic_name') ?? brand ?? (Object.keys(product).length > 1 ? ean : null);
	if (!name || !ean) return null;
	const nutriments =
		product.nutriments && typeof product.nutriments === 'object'
			? (product.nutriments as Record<string, unknown>)
			: {};

	const allergens = mapAllergens(tags(product.allergens_tags));
	const traces = mapAllergens(tags(product.traces_tags));
	const labels = tags(product.labels_tags);

	return {
		ean,
		name,
		brand,
		quantity: text(product.quantity),
		ingredients: pick('ingredients_text'),
		imageUrl: text(product.image_front_small_url),
		allergens: allergens.standard,
		traces: traces.standard.filter(id => !allergens.standard.includes(id)),
		otherAllergens: allergens.other,
		isVegan: labels.includes('en:vegan'),
		isVegetarian: labels.includes('en:vegetarian') || labels.includes('en:vegan'),
		nutriScore: grade(product.nutriscore_grade),
		ecoScore: grade(product.ecoscore_grade),
		novaGroup: novaGroup(product.nova_group),
		nutrition: {
			energyKcal: amount(nutriments, 'energy-kcal'),
			fat: amount(nutriments, 'fat'),
			saturatedFat: amount(nutriments, 'saturated-fat'),
			sugars: amount(nutriments, 'sugars'),
			salt: amount(nutriments, 'salt')
		}
	};
}

export type Lookup =
	| { status: 'found'; product: Product }
	| { status: 'unknown' }
	| { status: 'offline' }
	| { status: 'error' };

/** `http` is injectable so the lookup is tested without the network. */
export async function lookupProduct(
	ean: string,
	locale: string,
	http: typeof fetch = fetch
): Promise<Lookup> {
	if (!/^\d{6,14}$/.test(ean)) return { status: 'unknown' };

	try {
		const response = await http(productUrl(ean, locale), { headers: { Accept: 'application/json' } });
		if (response.status === 404) return { status: 'unknown' };
		if (!response.ok) return { status: 'error' };

		const product = parseProduct(await response.json(), locale);
		return product ? { status: 'found', product } : { status: 'unknown' };
	} catch {
		return { status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error' };
	}
}
