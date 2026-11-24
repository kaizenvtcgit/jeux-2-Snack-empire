// Toutes les valeurs d'équilibrage du jeu sont ici.

export const RECIPES = [
  { id: 'burger', name: 'Burger', emoji: '🍔', base: 5, unlock: 0, up: 10 },
  { id: 'fries', name: 'Frites', emoji: '🍟', base: 8, unlock: 150, up: 40 },
  { id: 'tacos', name: 'Tacos', emoji: '🌮', base: 20, unlock: 1200, up: 300 },
  { id: 'hotdog', name: 'Hot-dog', emoji: '🌭', base: 55, unlock: 8000, up: 2000 },
  { id: 'bubble', name: 'Bubble tea', emoji: '🧋', base: 150, unlock: 45000, up: 12000 },
];

export const UPGRADES = {
  speed: { name: 'Grill turbo', emoji: '🔥', base: 25, growth: 1.17, max: 40 },
  marketing: { name: 'Publicité', emoji: '📣', base: 50, growth: 1.2, max: 30 },
  queue: { name: "Espace d'attente", emoji: '🪴', base: 120, growth: 1.65, max: 8 },
};

/* Niveau 2 : le marché couvert (s'ouvre après les 4 camions, sans rien perdre) */
export const MARKET_RECIPES = [
  { id: 'croissant', name: 'Croissant', emoji: '🥐', base: 400, unlock: 0, up: 20000 },
  { id: 'cheese', name: 'Planche de fromages', emoji: '🧀', base: 900, unlock: 400000, up: 60000 },
  { id: 'juice', name: 'Jus de fruits frais', emoji: '🍓', base: 2000, unlock: 3e6, up: 200000 },
  { id: 'salad', name: 'Salade fermière', emoji: '🥗', base: 5000, unlock: 2e7, up: 800000 },
  { id: 'oysters', name: "Plateau d'huîtres", emoji: '🦪', base: 12000, unlock: 1.2e8, up: 3e6 },
  { id: 'tart', name: 'Tarte aux fraises', emoji: '🍰', base: 30000, unlock: 8e8, up: 8e6 },
  { id: 'charcuterie', name: 'Planche de charcuterie', emoji: '🥓', base: 75000, unlock: 5e9, up: 2e7 },
];
/* Niveau 3 : le port (s'ouvre après les 6 étals du marché, sans rien perdre) */
export const PORT_RECIPES = [
  { id: 'fishchips', name: 'Fish & chips', emoji: '🐟', base: 2e5, unlock: 0, up: 1e7 },
  { id: 'calamari', name: 'Calamars frits', emoji: '🦑', base: 5e5, unlock: 4e11, up: 3e7 },
  { id: 'gambas', name: 'Brochette de gambas', emoji: '🦐', base: 1.2e6, unlock: 3e12, up: 1e8 },
  { id: 'sushi', name: 'Plateau de sushis', emoji: '🍣', base: 3e6, unlock: 2e13, up: 4e8 },
  { id: 'oysters12', name: "Douzaine d'huîtres", emoji: '🦪', base: 8e6, unlock: 1.5e14, up: 1.5e9 },
  { id: 'paella', name: 'Paella royale', emoji: '🥘', base: 2e7, unlock: 1e15, up: 6e9 },
  { id: 'lobster', name: 'Homard grillé', emoji: '🦞', base: 5e7, unlock: 7e15, up: 2e10 },
  { id: 'salmon', name: 'Saumon fumé maison', emoji: '🐠', base: 1.2e8, unlock: 5e16, up: 5e10 },
  { id: 'cocktail', name: 'Cocktail de fruits', emoji: '🍹', base: 3e8, unlock: 3e17, up: 1.2e11 },
];
/* Niveau 4 : la fête foraine (devant le marché, s'ouvre après les 8 boutiques du port) */
export const FAIR_RECIPES = [
  { id: 'cottoncandy', name: 'Barbe à papa', emoji: '🍭', base: 8e8, unlock: 0, up: 4e10 },
  { id: 'candyapple', name: "Pomme d'amour", emoji: '🍎', base: 2e9, unlock: 3e18, up: 1.2e11 },
  { id: 'churros', name: 'Churros', emoji: '🥖', base: 5e9, unlock: 2e19, up: 4e11 },
  { id: 'fairwaffle', name: 'Gaufre chantilly', emoji: '🧇', base: 1.2e10, unlock: 1.5e20, up: 1.5e12 },
  { id: 'popcorn', name: 'Popcorn caramel', emoji: '🍿', base: 3e10, unlock: 1e21, up: 5e12 },
  { id: 'bighotdog', name: 'Hot-dog géant', emoji: '🌭', base: 8e10, unlock: 7e21, up: 2e13 },
  { id: 'donut', name: 'Beignet au sucre', emoji: '🍩', base: 2e11, unlock: 5e22, up: 8e13 },
  { id: 'lemonade', name: 'Limonade maison', emoji: '🍋', base: 5e11, unlock: 3e23, up: 3e14 },
];
/* Niveau 5 : la plage (à gauche de la fête foraine, s'ouvre après ses 8 stands) */
export const BEACH_RECIPES = [
  { id: 'icecream', name: 'Glace italienne', emoji: '🍦', base: 8e11, unlock: 0, up: 4e13 },
  { id: 'granita', name: 'Granité', emoji: '🍧', base: 2e12, unlock: 2e25, up: 1.2e14 },
  { id: 'watermelon', name: 'Pastèque fraîche', emoji: '🍉', base: 5e12, unlock: 1.5e26, up: 4e14 },
  { id: 'crepe', name: 'Crêpe au sucre', emoji: '🥞', base: 1.2e13, unlock: 1e27, up: 1.5e15 },
  { id: 'shrimp', name: 'Beignets de crevettes', emoji: '🍤', base: 3e13, unlock: 7e27, up: 5e15 },
  { id: 'panini', name: 'Panini', emoji: '🥪', base: 8e13, unlock: 5e28, up: 2e16 },
  { id: 'coconut', name: 'Noix de coco', emoji: '🥥', base: 2e14, unlock: 3e29, up: 8e16 },
  { id: 'smoothie', name: 'Smoothie tropical', emoji: '🥤', base: 5e14, unlock: 2e30, up: 3e17 },
];
export const allRecipes = () => [...RECIPES, ...MARKET_RECIPES, ...PORT_RECIPES, ...FAIR_RECIPES, ...BEACH_RECIPES];

/** Premier emplacement de chaque zone (0-3 : camions, 4-9 : étals du marché, 10-15 : boutiques du port). */
export const MARKET_FIRST = 4;
export const PORT_FIRST = 10;
export const FAIR_FIRST = 18;
export const BEACH_FIRST = 26;

/** Les zones (niveaux) du jeu, dans l'ordre. */
export const ZONES = [
  { id: 'parking', first: 0, count: 4, recipes: RECIPES, level: 1 },
  { id: 'market', first: MARKET_FIRST, count: 6, recipes: MARKET_RECIPES, level: 2 },
  { id: 'port', first: PORT_FIRST, count: 8, recipes: PORT_RECIPES, level: 3 },
  { id: 'fair', first: FAIR_FIRST, count: 8, recipes: FAIR_RECIPES, level: 4 },
  { id: 'beach', first: BEACH_FIRST, count: 8, recipes: BEACH_RECIPES, level: 5 },
];
/** Zone d'un emplacement. */
export const zoneOf = (i) => ZONES.find((z) => i >= z.first && i < z.first + z.count);
export const zoneById = (id) => ZONES.find((z) => z.id === id);

// 4 camions, 6 étals du marché, 8 boutiques du port (le 1er emplacement d'une zone l'ouvre)
export const STAND_COST = [
  0, 5000, 60000, 750000,
  2.5e6, 2e7, 1.5e8, 1e9, 6e9, 4e10,
  2.5e11, 1.5e12, 1e13, 7e13, 5e14, 3e15, 2e16, 1.5e17,
  1e18, 6e18, 4e19, 3e20, 2e21, 1.5e22, 1e23, 8e23,
  6e24, 4e25, 3e26, 2e27, 1.5e28, 1e29, 7e29, 5e30,
];
export const COOK_COST = [
  [0, 400, 2500], [0, 6000, 30000], [0, 80000, 400000], [0, 1e6, 5e6],
  [0, 4e6, 2e7], [0, 3e7, 1.5e8], [0, 2e8, 1e9], [0, 1.5e9, 7e9], [0, 1e10, 5e10], [0, 6e10, 3e11],
  [0, 4e11, 2e12], [0, 3e12, 1.5e13], [0, 2e13, 1e14], [0, 1.5e14, 7e14], [0, 1e15, 5e15], [0, 6e15, 3e16],
  [0, 4e16, 2e17], [0, 3e17, 1.5e18],
  [0, 1.6e18, 8e18], [0, 1e19, 5e19], [0, 6e19, 3e20], [0, 5e20, 2.5e21],
  [0, 3e21, 1.5e22], [0, 2.5e22, 1.2e23], [0, 1.6e23, 8e23], [0, 1.3e24, 6e24],
  ...[6e24, 4e25, 3e26, 2e27, 1.5e28, 1e29, 7e29, 5e30].map((c) => [0, 1.6 * c, 8 * c]),
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
export const COOK_FACTOR = [1, 1.8, 2.5];
export const MAX_COOKS = 3;

export const BOOST_SECONDS = 180;
export const AD_COOLDOWN = 60;
export const OFFLINE_RATIO = 0.5;
export const OFFLINE_MAX_S = 8 * 3600;

export const recipePrice = (r, lvl) => (lvl <= 0 ? 0 : r.base * (1 + 0.2 * (lvl - 1)) * 2 ** Math.floor(lvl / 10));
export const recipeUpCost = (r, lvl) => Math.ceil(r.up * 1.15 ** (lvl - 1));
export const upgradeCost = (u, lvl) => Math.ceil(u.base * u.growth ** lvl);
export const prepTime = (speedLvl) => Math.max(0.35, 2.8 * 0.92 ** speedLvl);
export const serviceTime = (speedLvl, cooks) => prepTime(speedLvl) / COOK_FACTOR[cooks - 1];
export const spawnInterval = (mkLvl, stands) => Math.max(0.22, (3.2 * 0.9 ** mkLvl) / stands);
export const queueCap = (qLvl) => 3 + qLvl;
