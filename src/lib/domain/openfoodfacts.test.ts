import { describe, expect, it } from 'vitest';
import { lookupProduct, parseProduct, productUrl } from './openfoodfacts';

const response = {
	code: '3017620422003',
	status: 1,
	product: {
		product_name: 'Hazelnut spread',
		product_name_fr: 'Pâte à tartiner',
		brands: 'Nutella, Ferrero',
		quantity: '400 g',
		ingredients_text: 'Sugar, palm oil, hazelnuts, skimmed milk powder',
		ingredients_text_fr: 'Sucre, huile de palme, noisettes, lait écrémé en poudre',
		allergens_tags: ['en:milk', 'en:nuts', 'en:soybeans', 'en:lupin'],
		traces_tags: ['en:gluten', 'en:milk'],
		labels_tags: ['en:vegetarian'],
		image_front_small_url: 'https://images.openfoodfacts.org/x.jpg'
	}
};

describe('parseProduct', () => {
	it('reads the name and the ingredients in the active language', () => {
		const product = parseProduct(response, 'fr-FR')!;

		expect(product.name).toBe('Pâte à tartiner');
		expect(product.ingredients).toContain('noisettes');
		expect(product.brand).toBe('Nutella');
	});

	it('falls back on the product’s own name when the language is missing', () => {
		expect(parseProduct(response, 'de')!.name).toBe('Hazelnut spread');
	});

	it('maps allergen tags to our standard ones and keeps the others', () => {
		const product = parseProduct(response, 'en')!;

		expect(product.allergens).toEqual(['milk', 'nuts', 'soy']);
		expect(product.otherAllergens).toEqual(['lupin']);
		expect(product.traces).toEqual(['gluten']);
		expect(product.isVegetarian).toBe(true);
		expect(product.isVegan).toBe(false);
	});

	it('returns null for an unknown barcode or a malformed answer', () => {
		expect(parseProduct({ status: 0, code: '1' }, 'en')).toBeNull();
		expect(parseProduct({ status: 1, code: '1', product: {} }, 'en')).toBeNull();
		expect(parseProduct('nope', 'en')).toBeNull();
	});
});

describe('lookupProduct', () => {
	const ok = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

	it('finds a product', async () => {
		const result = await lookupProduct('3017620422003', 'fr', ok(response));
		expect(result.status).toBe('found');
	});

	it('says unknown for a 404, a bad barcode and an empty answer', async () => {
		expect((await lookupProduct('3017620422003', 'fr', ok({}, 404))).status).toBe('unknown');
		expect((await lookupProduct('abc', 'fr', ok(response))).status).toBe('unknown');
		expect((await lookupProduct('3017620422003', 'fr', ok({ status: 0 }))).status).toBe('unknown');
	});

	it('reports a failure instead of throwing', async () => {
		const down = (async () => {
			throw new Error('network');
		}) as typeof fetch;
		expect(['error', 'offline']).toContain((await lookupProduct('3017620422003', 'fr', down)).status);
		expect((await lookupProduct('3017620422003', 'fr', ok({}, 500))).status).toBe('error');
	});

	it('sends only the barcode and the language fields', () => {
		const url = productUrl('3017620422003', 'fr-FR');
		expect(url).toContain('/product/3017620422003.json');
		expect(url).toContain('product_name_fr');
	});
});
