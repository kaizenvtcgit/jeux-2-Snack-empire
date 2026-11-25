import { L } from './i18n.js';
// Toutes les valeurs d'équilibrage du jeu sont ici.

/*
 * NOUVELLE VERSION (tycoon + cuisine) — étape 1 : seul le camion n°1 (hot-dogs) est ouvert.
 * Chaque camion a sa spécialité et sa mini-cuisine : 1 hot-dogs, 2 pizza, 3 tacos, 4 burgers (à venir).
 * extra : ingrédient imposé par le modèle (ajouté comme une garniture).
 */
export const HOTDOG_MODELS = [
  { id: 'hotdog', name: L('Hot-dog classique', 'Classic hot dog'), emoji: '🌭', base: 5, unlock: 0, up: 10, extra: null },
  { id: 'cheesedog', name: L('Cheese-dog', 'Cheese dog'), emoji: '🧀', base: 9, unlock: 150, up: 40, extra: 'cheese' },
  { id: 'chilidog', name: L('Chili-dog', 'Chili dog'), emoji: '🌶️', base: 22, unlock: 1200, up: 300, extra: 'chili' },
];
/** Spécialités des camions 2 à 4 (pas encore ouverts). */
export const TRUCK_SPECIALTIES = [
  { emoji: '🍕', name: L('Pizza', 'Pizza') },
  { emoji: '🌮', name: L('Tacos', 'Tacos') },
  { emoji: '🍔', name: L('Burgers', 'Burgers') },
];
/** Nombre d'emplacements ouverts à l'achat pour l'instant (étape 1 : le camion n°1 seulement). */
export const OPEN_STANDS = 1;
/** Étoiles nécessaires pour ouvrir le niveau 2 (le marché). */
export const STARS_GOAL = 100;
export const TRUCK_RECIPES = [
  { id: 'fries', name: L('Frites', 'Fries'), emoji: '🍟', base: 8, unlock: 150, up: 40 },
];
export const RECIPES = [...HOTDOG_MODELS, ...TRUCK_RECIPES];

/** Garnitures du camion à hot-dogs (toutes disponibles dès le départ). */
export const TOPPINGS = [
  { id: 'ketchup', name: L('Ketchup', 'Ketchup'), emoji: '🍅', unlock: 0, price: 0.2 },
  { id: 'mustard', name: L('Moutarde', 'Mustard'), emoji: '🟡', unlock: 0, price: 0.2 },
  { id: 'onions', name: L('Oignons', 'Onions'), emoji: '🧅', unlock: 0, price: 0.3 },
];
/** Ingrédients des modèles (imposés par le modèle commandé). */
export const EXTRAS = {
  cheese: { name: L('cheddar fondu', 'melted cheddar'), emoji: '🧀', price: 0 },
  chili: { name: L('chili con carne', 'chili con carne'), emoji: '🫘', price: 0 },
};
/**
 * Équipement d'un camion (3 améliorations, visibles dans le camion ou dehors) :
 * speed : cuisson et préparation −15 % / niveau ; counter : +1 place dans la file / niveau ; sign : +20 % de clients / niveau.
 */
export const EQUIPMENT = {
  speed: { name: L('Cuisson rapide', 'Fast cooking'), emoji: '⚡', costs: [100, 900, 6000] },
  counter: { name: L('Comptoir agrandi', 'Bigger counter'), emoji: '🧍', costs: [250, 2500] },
  sign: { name: L('Enseigne lumineuse', 'Neon sign'), emoji: '💡', costs: [400, 4000, 30000] },
};
export const hotdogModel = (id) => HOTDOG_MODELS.find((m) => m.id === id) || HOTDOG_MODELS[0];

export const UPGRADES = {
  speed: { name: L('Grill turbo', 'Turbo grill'), emoji: '🔥', base: 25, growth: 1.17, max: 40 },
  marketing: { name: L('Publicité', 'Advertising'), emoji: '📣', base: 50, growth: 1.2, max: 30 },
  queue: { name: L("Espace d'attente", 'Waiting area'), emoji: '🪴', base: 120, growth: 1.65, max: 8 },
};

/* Niveau 2 : le marché couvert (s'ouvre après les 4 camions, sans rien perdre) */
export const MARKET_RECIPES = [
  { id: 'croissant', name: L('Croissant', 'Croissant'), emoji: '🥐', base: 400, unlock: 0, up: 4000 },
  { id: 'cheese', name: L('Planche de fromages', 'Cheese board'), emoji: '🧀', base: 900, unlock: 80000, up: 12000 },
  { id: 'juice', name: L('Jus de fruits frais', 'Fresh juice'), emoji: '🍓', base: 2000, unlock: 6e5, up: 40000 },
  { id: 'salad', name: L('Salade fermière', 'Farm salad'), emoji: '🥗', base: 5000, unlock: 4e6, up: 1.5e5 },
  { id: 'oysters', name: L("Plateau d'huîtres", 'Oyster platter'), emoji: '🦪', base: 12000, unlock: 2.5e7, up: 6e5 },
  { id: 'tart', name: L('Tarte aux fraises', 'Strawberry tart'), emoji: '🍰', base: 30000, unlock: 1.5e8, up: 1.5e6 },
  { id: 'charcuterie', name: L('Planche de charcuterie', 'Charcuterie board'), emoji: '🥓', base: 75000, unlock: 1e9, up: 4e6 },
];
/* Niveau 3 : le port (s'ouvre après les 6 étals du marché, sans rien perdre) */
export const PORT_RECIPES = [
  { id: 'fishchips', name: L('Fish & chips', 'Fish & chips'), emoji: '🐟', base: 2e5, unlock: 0, up: 6e5 },
  { id: 'calamari', name: L('Calamars frits', 'Fried calamari'), emoji: '🦑', base: 5e5, unlock: 2e10, up: 1.5e6 },
  { id: 'gambas', name: L('Brochette de gambas', 'Prawn skewer'), emoji: '🦐', base: 1.2e6, unlock: 1.5e11, up: 6e6 },
  { id: 'sushi', name: L('Plateau de sushis', 'Sushi platter'), emoji: '🍣', base: 3e6, unlock: 1.2e12, up: 2e7 },
  { id: 'oysters12', name: L("Douzaine d'huîtres", 'Dozen oysters'), emoji: '🦪', base: 8e6, unlock: 8e12, up: 8e7 },
  { id: 'paella', name: L('Paella royale', 'Royal paella'), emoji: '🥘', base: 2e7, unlock: 6e13, up: 3e8 },
  { id: 'lobster', name: L('Homard grillé', 'Grilled lobster'), emoji: '🦞', base: 5e7, unlock: 4e14, up: 1.2e9 },
  { id: 'salmon', name: L('Saumon fumé maison', 'House smoked salmon'), emoji: '🐠', base: 1.2e8, unlock: 3e15, up: 3e9 },
  { id: 'cocktail', name: L('Cocktail de fruits', 'Fruit cocktail'), emoji: '🍹', base: 3e8, unlock: 1.5e16, up: 6e9 },
];
/* Niveau 4 : la plage (à gauche de la fête, s'ouvre après les 8 boutiques du port) */
export const BEACH_RECIPES = [
  { id: 'icecream', name: L('Glace italienne', 'Soft-serve ice cream'), emoji: '🍦', base: 8e8, unlock: 0, up: 1.5e8 },
  { id: 'granita', name: L('Granité', 'Slushie'), emoji: '🍧', base: 2e9, unlock: 1.2e16, up: 5e8 },
  { id: 'watermelon', name: L('Pastèque fraîche', 'Fresh watermelon'), emoji: '🍉', base: 5e9, unlock: 8e16, up: 1.5e9 },
  { id: 'crepe', name: L('Crêpe au sucre', 'Sugar crepe'), emoji: '🥞', base: 1.2e10, unlock: 6e17, up: 6e9 },
  { id: 'shrimp', name: L('Beignets de crevettes', 'Shrimp fritters'), emoji: '🍤', base: 3e10, unlock: 4e18, up: 2e10 },
  { id: 'panini', name: L('Panini', 'Panini'), emoji: '🥪', base: 8e10, unlock: 3e19, up: 8e10 },
  { id: 'coconut', name: L('Noix de coco', 'Coconut'), emoji: '🥥', base: 2e11, unlock: 2e20, up: 3e11 },
  { id: 'smoothie', name: L('Smoothie tropical', 'Tropical smoothie'), emoji: '🥤', base: 5e11, unlock: 1.2e21, up: 1.2e12 },
];
/* Niveau 5 : la fête foraine (devant le marché, s'ouvre après les 8 paillotes de la plage) */
export const FAIR_RECIPES = [
  { id: 'cottoncandy', name: L('Barbe à papa', 'Cotton candy'), emoji: '🍭', base: 8e11, unlock: 0, up: 4e9 },
  { id: 'candyapple', name: L("Pomme d'amour", 'Candy apple'), emoji: '🍎', base: 2e12, unlock: 2e21, up: 1.2e10 },
  { id: 'churros', name: L('Churros', 'Churros'), emoji: '🥖', base: 5e12, unlock: 1.5e22, up: 4e10 },
  { id: 'fairwaffle', name: L('Gaufre chantilly', 'Whipped cream waffle'), emoji: '🧇', base: 1.2e13, unlock: 1e23, up: 1.5e11 },
  { id: 'popcorn', name: L('Popcorn caramel', 'Caramel popcorn'), emoji: '🍿', base: 3e13, unlock: 6e23, up: 5e11 },
  { id: 'bighotdog', name: L('Hot-dog géant', 'Giant hot dog'), emoji: '🌭', base: 8e13, unlock: 5e24, up: 2e12 },
  { id: 'donut', name: L('Beignet au sucre', 'Sugar donut'), emoji: '🍩', base: 2e14, unlock: 3e25, up: 7.5e12 },
  { id: 'lemonade', name: L('Limonade maison', 'Homemade lemonade'), emoji: '🍋', base: 5e14, unlock: 2e26, up: 3e13 },
];
export const allRecipes = () => [...RECIPES, ...MARKET_RECIPES, ...PORT_RECIPES, ...BEACH_RECIPES, ...FAIR_RECIPES];

/** Premier emplacement de chaque zone (0-3 : camions, 4-9 : marché, 10-17 : port, 18-25 : plage, 26-33 : fête). */
export const MARKET_FIRST = 4;
export const PORT_FIRST = 10;
export const BEACH_FIRST = 18;
export const FAIR_FIRST = 26;
/** Les zones (niveaux) du jeu, dans l'ordre. */
export const ZONES = [
  { id: 'parking', first: 0, count: 4, recipes: RECIPES, level: 1 },
  { id: 'market', first: MARKET_FIRST, count: 6, recipes: MARKET_RECIPES, level: 2 },
  { id: 'port', first: PORT_FIRST, count: 8, recipes: PORT_RECIPES, level: 3 },
  { id: 'beach', first: BEACH_FIRST, count: 8, recipes: BEACH_RECIPES, level: 4 },
  { id: 'fair', first: FAIR_FIRST, count: 8, recipes: FAIR_RECIPES, level: 5 },
];
/** Zone d'un emplacement. */
export const zoneOf = (i) => ZONES.find((z) => i >= z.first && i < z.first + z.count);
export const zoneById = (id) => ZONES.find((z) => z.id === id);

// Prix calibrés par simulation (joueur actif, sans pubs ni gains hors ligne) : camions finis vers 13 min,
// marché vers 1 h, port vers 2 h 20, plage vers 6 h 30, fête (fin du jeu) vers 11 h.
// (le 1er emplacement d'une zone l'ouvre)
export const STAND_COST = [
  0, 150, 4000, 60000,                                      // camions
  2e6, 1e7, 4e7, 1.2e8, 5e8, 2e9,                           // marché
  7.5e9, 4e11, 5e12, 2e13, 5e13, 1.2e14, 2e14, 3e14,        // port
  1.2e15, 8e16, 1.2e18, 5e18, 2e19, 6e19, 1.2e20, 1.5e20,   // plage
  2e20, 2e22, 3e23, 1.2e24, 3e24, 6e24, 1.2e25, 1.5e25,     // fête foraine
];
/** Prix du 2e et du 3e vendeur de chaque emplacement (camion n°1 : il démarre sans cuisinier, le 1er coûte 50 $). */
export const COOK_COST = [
  [50, 150, 600], [0, 200, 800], [0, 5000, 25000], [0, 80000, 4e5],
  [0, 3e6, 1.5e7], [0, 1.5e7, 7.5e7], [0, 5e7, 2.5e8], [0, 2e8, 8e8], [0, 8e8, 4e9], [0, 3e9, 1.5e10],
  [0, 1.2e10, 6e10], [0, 8e11, 4e12], [0, 1e13, 5e13], [0, 4e13, 2e14], [0, 1e14, 5e14], [0, 2.5e14, 1.2e15], [0, 4e14, 2e15], [0, 6e14, 3e15],
  [0, 2e15, 1e16], [0, 1.2e17, 6e17], [0, 2e18, 8e18], [0, 8e18, 4e19], [0, 3e19, 1.5e20], [0, 1e20, 5e20], [0, 2e20, 1e21], [0, 2.5e20, 1.2e21],
  [0, 3e20, 1.5e21], [0, 3e22, 1.5e23], [0, 5e23, 2.5e24], [0, 2e24, 1e25], [0, 5e24, 2.5e25], [0, 1e25, 5e25], [0, 2e25, 1e26], [0, 2.5e25, 1.2e26],
];
/* Canicule à la plage : régulièrement, le soleil tape, les baigneurs affluent et les ventes de la plage valent ×3 */
export const HEAT_EVERY = 135;      // secondes entre deux canicules
export const HEAT_SECONDS = 35;     // durée de la canicule
export const HEAT_MULT = 3;
export const HEAT_CROWD = 12;       // baigneurs supplémentaires qui arrivent

/* Nuit à la fête foraine : la nuit tombe régulièrement, la fête s'illumine et ses ventes valent ×3 */
export const DAY_SECONDS = 150;     // durée du jour entre deux nuits
export const NIGHT_SECONDS = 40;    // durée de la nuit
export const NIGHT_MULT = 3;
export const NIGHT_CROWD = 12;      // visiteurs supplémentaires qui viennent de la ville

/* Arrivage du pêcheur (port) : un bateau accoste régulièrement, les ventes du port valent ×3 */
export const ARRIVAL_EVERY = 120;   // secondes entre deux bateaux
export const ARRIVAL_SECONDS = 30;  // durée de l'arrivage
export const ARRIVAL_MULT = 3;
export const ARRIVAL_CROWD = 10;    // clients qui descendent du bateau
/** Cuisine : supplément de chaque garniture (part du prix du hot-dog). */
export const TOPPING_PRICE = Object.fromEntries(TOPPINGS.map((t) => [t.id, t.price]));
export const COOK_FACTOR = [1, 1.8, 2.5];
/** Cuisine : quand le joueur est dans le camion, le cuisinier prend au moins ce temps pour préparer un hot-dog (on le voit faire). */
export const COOK_SHOW_SECONDS = 7;
/** Camion n°1 : temps qu'il faut à un cuisinier pour préparer un hot-dog (le « Grill turbo » l'accélère). */
/** Temps qu'il faut à un cuisinier pour préparer un hot-dog (la « Cuisson rapide » l'accélère). */
export const hotdogPrepTime = (hd = {}) => COOK_SHOW_SECONDS * (1 - 0.15 * ((hd.eq && hd.eq.speed) || 0));
/** État du camion à hot-dogs dans la sauvegarde (complété si absent). */
export function hotdogState(S) {
  S.hd = S.hd || {};
  S.hd.tops = Object.assign({ ketchup: 1, mustard: 1, onions: 1 }, S.hd.tops || {});
  S.hd.eq = Object.assign(Object.fromEntries(Object.keys(EQUIPMENT).map((k) => [k, 0])), S.hd.eq || {});
  S.stars = S.stars || 0;
  return S.hd;
}
export const MAX_COOKS = 3;
/** Nombre maximum de cuisiniers / vendeurs d'un emplacement : 2 dans les camions, 3 ailleurs. */
export const maxCooks = (i) => (i < MARKET_FIRST ? 2 : MAX_COOKS);

export const BOOST_SECONDS = 180;
export const AD_COOLDOWN = 60;
export const OFFLINE_RATIO = 0.5;
export const OFFLINE_MAX_S = 8 * 3600;

export const recipePrice = (r, lvl) => (lvl <= 0 ? 0 : r.base * (1 + 0.2 * (lvl - 1)) * 2 ** Math.floor(lvl / 10));
export const recipeUpCost = (r, lvl) => Math.ceil(r.up * 1.15 ** (lvl - 1));
export const upgradeCost = (u, lvl) => Math.ceil(u.base * u.growth ** lvl);
export const prepTime = (speedLvl) => Math.max(0.35, 2.8 * 0.92 ** speedLvl);
export const serviceTime = (speedLvl, cooks) => (cooks > 0 ? prepTime(speedLvl) / COOK_FACTOR[cooks - 1] : Infinity); // 0 cuisinier : personne ne sert
export const spawnInterval = (mkLvl, stands) => Math.max(0.22, (3.2 * 0.9 ** mkLvl) / stands);
export const queueCap = (qLvl) => 3 + qLvl;
