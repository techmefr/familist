import { describe, expect, it } from 'vitest';
import { KEYWORDS, matchFoodGroups, STANDARD_ALLERGENS, type FoodGroup } from './allergens';

const LOCALES = ['en', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'ar', 'zh', 'mg'];

const SAMPLES: Record<string, Partial<Record<FoodGroup, string>>> = {
	en: { milk: 'whole milk', egg: '6 eggs', peanut: 'peanut butter', nuts: 'almonds', gluten: 'wheat flour', fish: 'salmon', shellfish: 'prawns', soy: 'tofu', sesame: 'sesame oil', mustard: 'mustard', celery: 'celery', pork: 'bacon' },
	fr: { milk: 'lait entier', egg: 'oeufs', peanut: 'cacahuètes', nuts: 'noisettes', gluten: 'farine de blé', fish: 'saumon fumé', shellfish: 'crevettes', soy: 'sauce soja', sesame: 'graines de sésame', mustard: 'moutarde', celery: 'céleri', pork: 'jambon' },
	de: { milk: 'Milch', egg: 'Eier', peanut: 'Erdnüsse', nuts: 'Haselnüsse', gluten: 'Weizenmehl', fish: 'Lachs', shellfish: 'Garnelen', soy: 'Sojasauce', sesame: 'Sesam', mustard: 'Senf', celery: 'Sellerie', pork: 'Schinken' },
	es: { milk: 'leche', egg: 'huevos', peanut: 'cacahuetes', nuts: 'almendras', gluten: 'harina de trigo', fish: 'atún', shellfish: 'gambas', soy: 'soja', sesame: 'sésamo', mustard: 'mostaza', celery: 'apio', pork: 'jamón' },
	it: { milk: 'latte', egg: 'uova', peanut: 'arachidi', nuts: 'nocciole', gluten: 'farina di grano', fish: 'tonno', shellfish: 'gamberi', soy: 'salsa di soia', sesame: 'sesamo', mustard: 'senape', celery: 'sedano', pork: 'prosciutto' },
	pt: { milk: 'leite', egg: 'ovos', peanut: 'amendoim', nuts: 'amêndoas', gluten: 'farinha de trigo', fish: 'bacalhau', shellfish: 'camarão', soy: 'soja', sesame: 'gergelim', mustard: 'mostarda', celery: 'aipo', pork: 'presunto' },
	ru: { milk: 'молоко', egg: 'яйца', peanut: 'арахис', nuts: 'миндаль', gluten: 'пшеничная мука', fish: 'лосось', shellfish: 'креветки', soy: 'соевый соус', sesame: 'кунжут', mustard: 'горчица', celery: 'сельдерей', pork: 'свинина' },
	ar: { milk: 'حليب', egg: 'بيض', peanut: 'فول سوداني', nuts: 'لوز', gluten: 'دقيق', fish: 'سمك', shellfish: 'جمبري', soy: 'صويا', sesame: 'سمسم', mustard: 'خردل', celery: 'كرفس', pork: 'لحم الخنزير' },
	zh: { milk: '牛奶', egg: '鸡蛋', peanut: '花生', nuts: '核桃', gluten: '面粉', fish: '三文鱼', shellfish: '虾', soy: '豆腐', sesame: '芝麻', mustard: '芥末', celery: '芹菜', pork: '猪肉' },
	mg: { milk: 'ronono', egg: 'atody', peanut: 'voanjo', nuts: 'amandy', gluten: 'lafarinina', fish: 'trondro', shellfish: 'foza', soy: 'tofu', sesame: 'sezame', mustard: 'moutarde', celery: 'celeri', pork: 'kisoa' }
};

describe('matchFoodGroups', () => {
	it('has a dictionary entry for every group in every shipped language', () => {
		for (const group of Object.keys(KEYWORDS) as FoodGroup[]) {
			for (const locale of LOCALES) {
				expect(KEYWORDS[group][locale]?.length ?? 0, `${group} in ${locale}`).toBeGreaterThan(0);
			}
		}
	});

	for (const locale of LOCALES) {
		it(`finds every group from a typical ${locale} item name`, () => {
			for (const [group, sample] of Object.entries(SAMPLES[locale])) {
				expect(matchFoodGroups(sample, locale), `${locale}: ${sample}`).toContain(group);
			}
		});
	}

	it('covers every standard allergen in the samples', () => {
		for (const allergen of STANDARD_ALLERGENS) expect(SAMPLES.en[allergen]).toBeTruthy();
	});

	it('knows a pesto contains nuts and milk', () => {
		expect(matchFoodGroups('pesto', 'en')).toEqual(expect.arrayContaining(['nuts', 'milk']));
	});

	it('does not find a word inside another', () => {
		expect(matchFoodGroups('graham crackers', 'en')).not.toContain('pork');
		expect(matchFoodGroups('', 'en')).toEqual([]);
	});

	it('reads English in any language, as households do', () => {
		expect(matchFoodGroups('tofu', 'ru')).toContain('soy');
	});
});
