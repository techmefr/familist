/**
 * Which words in an ingredient or an item name point at an allergen or a dietary rule (#477).
 *
 * The dictionary is written per language because a match is a word written by a person in their own tongue:
 * a fixed English list would miss "arachide" and "cacahuete". The matcher reads the active language plus
 * English, since a household writes "pesto" or "tofu" in every language. It is a hint and never a guarantee:
 * it warns, it never blocks, and what it does not know it does not claim to be safe.
 */
export const STANDARD_ALLERGENS = [
	'milk',
	'egg',
	'peanut',
	'nuts',
	'gluten',
	'fish',
	'shellfish',
	'soy',
	'sesame',
	'mustard',
	'celery'
] as const;
export type StandardAllergen = (typeof STANDARD_ALLERGENS)[number];

/** Not an allergen but a food the dietary rules exclude. */
export type FoodGroup = StandardAllergen | 'pork';

type Words = Partial<Record<string, readonly string[]>> & { en: readonly string[] };

export const KEYWORDS: Record<FoodGroup, Words> = {
	milk: {
		en: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'whey', 'parmesan', 'mozzarella', 'lactose', 'pesto'],
		fr: ['lait', 'fromage', 'beurre', 'creme', 'yaourt', 'yogourt', 'lactose', 'pesto'],
		de: ['milch', 'kase', 'butter', 'sahne', 'joghurt', 'molke', 'quark', 'pesto'],
		es: ['leche', 'queso', 'mantequilla', 'nata', 'yogur', 'suero', 'parmesano', 'pesto'],
		it: ['latte', 'formaggio', 'burro', 'panna', 'yogurt', 'siero', 'parmigiano', 'pesto'],
		pt: ['leite', 'queijo', 'manteiga', 'nata', 'iogurte', 'soro', 'parmesao', 'pesto'],
		ru: ['молок', 'сыр', 'сливочное масло', 'сливк', 'йогурт', 'творог', 'кефир', 'песто'],
		ar: ['حليب', 'جبن', 'زبدة', 'قشدة', 'لبن', 'زبادي'],
		zh: ['牛奶', '奶酪', '黄油', '奶油', '酸奶', '乳'],
		mg: ['ronono', 'fromazy', 'dibera', 'yaorta']
	},
	egg: {
		en: ['egg', 'mayonnaise', 'meringue'],
		fr: ['oeuf', 'mayonnaise', 'meringue'],
		de: ['eier', 'spiegelei', 'mayonnaise'],
		es: ['huevo', 'mayonesa'],
		it: ['uov', 'maionese'],
		pt: ['ovo', 'maionese'],
		ru: ['яйц', 'майонез'],
		ar: ['بيض'],
		zh: ['蛋'],
		mg: ['atody']
	},
	peanut: {
		en: ['peanut', 'groundnut'],
		fr: ['cacahuete', 'arachide'],
		de: ['erdnuss', 'erdnusse'],
		es: ['cacahuete', 'mani'],
		it: ['arachid', 'nocciolina americana'],
		pt: ['amendoim'],
		ru: ['арахис'],
		ar: ['فول سوداني'],
		zh: ['花生'],
		mg: ['voanjo']
	},
	nuts: {
		en: ['almond', 'hazelnut', 'walnut', 'cashew', 'pistachio', 'pecan', 'pine nut', 'pesto', 'praline', 'nougat'],
		fr: ['amande', 'noisette', 'noix', 'cajou', 'pistache', 'pecan', 'pignon', 'pesto', 'praline'],
		de: ['mandel', 'haselnuss', 'walnuss', 'cashew', 'pistazie', 'pinienkern', 'pesto'],
		es: ['almendra', 'avellana', 'nuez', 'anacardo', 'pistacho', 'pinon', 'pesto'],
		it: ['mandorl', 'nocciol', 'noce', 'noci', 'anacard', 'pistacch', 'pinoli', 'pesto'],
		pt: ['amendoa', 'avela', 'noz', 'caju', 'pistache', 'pinhao', 'pesto'],
		ru: ['миндал', 'фундук', 'грецк', 'кешью', 'фисташ', 'кедров', 'песто'],
		ar: ['لوز', 'بندق', 'جوز', 'كاجو', 'فستق'],
		zh: ['杏仁', '榛子', '核桃', '腰果', '开心果', '松子'],
		mg: ['amandy', 'noisette']
	},
	gluten: {
		en: ['wheat', 'flour', 'bread', 'pasta', 'barley', 'rye', 'semolina', 'couscous', 'biscuit'],
		fr: ['ble', 'farine', 'pain', 'pates', 'orge', 'seigle', 'semoule', 'couscous', 'biscuit'],
		de: ['weizen', 'mehl', 'brot', 'nudel', 'gerste', 'roggen', 'griess'],
		es: ['trigo', 'harina', 'pan', 'pasta', 'cebada', 'centeno', 'semola'],
		it: ['grano', 'farina', 'pane', 'pasta', 'orzo', 'segale', 'semola'],
		pt: ['trigo', 'farinha', 'pao', 'massa', 'cevada', 'centeio'],
		ru: ['пшениц', 'мука', 'хлеб', 'макарон', 'ячмень', 'рожь'],
		ar: ['قمح', 'دقيق', 'خبز', 'معكرونة'],
		zh: ['小麦', '面粉', '面包', '面条', '大麦'],
		mg: ['lafarinina', 'mofo', 'paty']
	},
	fish: {
		en: ['fish', 'salmon', 'tuna', 'cod', 'anchov', 'sardine', 'trout'],
		fr: ['poisson', 'saumon', 'thon', 'cabillaud', 'anchois', 'sardine', 'truite'],
		de: ['fisch', 'lachs', 'thunfisch', 'kabeljau', 'sardelle', 'forelle'],
		es: ['pescado', 'salmon', 'atun', 'bacalao', 'anchoa', 'sardina', 'trucha'],
		it: ['pesce', 'salmone', 'tonno', 'merluzzo', 'acciuga', 'sardina', 'trota'],
		pt: ['peixe', 'salmao', 'atum', 'bacalhau', 'anchova', 'sardinha', 'truta'],
		ru: ['рыб', 'лосос', 'тунец', 'треск', 'анчоус', 'сардин', 'форел'],
		ar: ['سمك', 'سلمون', 'تونة'],
		zh: ['鱼', '三文鱼', '金枪鱼', '鳕鱼'],
		mg: ['trondro', 'saumon']
	},
	shellfish: {
		en: ['shrimp', 'prawn', 'crab', 'lobster', 'mussel', 'oyster', 'clam', 'squid', 'shellfish'],
		fr: ['crevette', 'crabe', 'homard', 'moule', 'huitre', 'calamar', 'langoustine', 'coquillage'],
		de: ['garnele', 'krabbe', 'hummer', 'muschel', 'auster', 'tintenfisch'],
		es: ['gamba', 'camaron', 'cangrejo', 'langosta', 'mejillon', 'ostra', 'calamar', 'marisco'],
		it: ['gamber', 'granchi', 'aragost', 'cozz', 'ostric', 'calamar', 'frutti di mare'],
		pt: ['camarao', 'caranguejo', 'lagosta', 'mexilhao', 'ostra', 'lula', 'marisco'],
		ru: ['креветк', 'краб', 'омар', 'мидии', 'устриц', 'кальмар'],
		ar: ['جمبري', 'سلطعون', 'محار'],
		zh: ['虾', '蟹', '龙虾', '贝', '鱿鱼'],
		mg: ['foza', 'makamba']
	},
	soy: {
		en: ['soy', 'tofu', 'edamame', 'miso'],
		fr: ['soja', 'tofu', 'edamame', 'miso'],
		de: ['soja', 'tofu', 'edamame', 'miso'],
		es: ['soja', 'tofu', 'edamame', 'miso'],
		it: ['soia', 'tofu', 'edamame', 'miso'],
		pt: ['soja', 'tofu', 'edamame', 'miso'],
		ru: ['соя', 'соев', 'тофу'],
		ar: ['صويا', 'توفو'],
		zh: ['大豆', '豆腐', '酱油', '豆浆'],
		mg: ['soja', 'tofu']
	},
	sesame: {
		en: ['sesame', 'tahini'],
		fr: ['sesame', 'tahini'],
		de: ['sesam', 'tahini'],
		es: ['sesamo', 'tahini'],
		it: ['sesamo', 'tahini'],
		pt: ['gergelim', 'sesamo', 'tahini'],
		ru: ['кунжут', 'тахини'],
		ar: ['سمسم', 'طحينة'],
		zh: ['芝麻'],
		mg: ['sezame']
	},
	mustard: {
		en: ['mustard'],
		fr: ['moutarde'],
		de: ['senf'],
		es: ['mostaza'],
		it: ['senape'],
		pt: ['mostarda'],
		ru: ['горчиц'],
		ar: ['خردل'],
		zh: ['芥末', '芥'],
		mg: ['moutarde']
	},
	celery: {
		en: ['celery'],
		fr: ['celeri'],
		de: ['sellerie'],
		es: ['apio'],
		it: ['sedano'],
		pt: ['aipo'],
		ru: ['сельдере'],
		ar: ['كرفس'],
		zh: ['芹菜'],
		mg: ['celeri']
	},
	pork: {
		en: ['pork', 'bacon', 'ham', 'lard', 'sausage', 'chorizo', 'salami'],
		fr: ['porc', 'jambon', 'lard', 'bacon', 'saucisse', 'saucisson', 'chorizo'],
		de: ['schwein', 'schinken', 'speck', 'wurst', 'salami'],
		es: ['cerdo', 'jamon', 'tocino', 'chorizo', 'salchicha'],
		it: ['maiale', 'prosciutto', 'pancetta', 'salsiccia', 'salame'],
		pt: ['porco', 'presunto', 'toucinho', 'chourico', 'salsicha'],
		ru: ['свинин', 'ветчин', 'бекон', 'сало', 'колбас'],
		ar: ['خنزير', 'لحم الخنزير'],
		zh: ['猪肉', '火腿', '培根', '香肠'],
		mg: ['kisoa']
	}
};

/** The food groups each dietary rule keeps out. `vegetarian` leaves meat to the person's own judgement. */
export const DIET_EXCLUDES: Record<string, readonly FoodGroup[]> = {
	vegetarian: ['fish', 'shellfish'],
	vegan: ['milk', 'egg', 'fish', 'shellfish'],
	'no-pork': ['pork'],
	halal: ['pork'],
	kosher: ['pork', 'shellfish'],
	'gluten-free': ['gluten'],
	'lactose-free': ['milk']
};

export const DIETS = Object.keys(DIET_EXCLUDES);

const fold = (text: string): string =>
	text
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase();

const isLatin = (word: string): boolean => /^[\p{Script=Latin}\s'-]+$/u.test(word);

function found(haystack: string, word: string): boolean {
	const needle = fold(word);
	if (!isLatin(needle)) return haystack.includes(needle);

	// A word may start a longer one ("almond" in "almonds") but must not sit in the middle of another
	// ("ham" is not in "graham"): the boundary is on the left only.
	let from = haystack.indexOf(needle);
	while (from !== -1) {
		if (from === 0 || !/[a-z]/.test(haystack[from - 1])) return true;
		from = haystack.indexOf(needle, from + 1);
	}
	return false;
}

/** Every food group whose words appear in `text`, read in `locale` and in English. */
export function matchFoodGroups(text: string, locale: string): FoodGroup[] {
	const haystack = fold(text);
	if (!haystack.trim()) return [];

	return (Object.keys(KEYWORDS) as FoodGroup[]).filter(group => {
		const words = [...(KEYWORDS[group][locale] ?? []), ...KEYWORDS[group].en];
		return words.some(word => found(haystack, word));
	});
}

export const isStandardAllergen = (id: string): id is StandardAllergen =>
	(STANDARD_ALLERGENS as readonly string[]).includes(id);
