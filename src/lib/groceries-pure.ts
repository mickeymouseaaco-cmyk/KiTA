/**
 * Groceries: a shared shopping list, sorted the way you walk a shop (fresh
 * things first, household last). Understands English and Malay item names.
 * Pure, so it's easy to test.
 */

export type Aisle = 'produce' | 'meat' | 'dairy' | 'bakery' | 'pantry' | 'drinks' | 'frozen' | 'snacks' | 'household' | 'other';

export type GroceryItem = {
  id: string;
  name: string;
  qty?: string;
  aisle: Aisle;
  done: boolean;
  doneBy?: string;
  addedBy: string;
  createdMs?: number;
};

export const AISLES: { id: Aisle; label: string }[] = [
  { id: 'produce', label: 'Fruit & veg' },
  { id: 'meat', label: 'Meat & fish' },
  { id: 'dairy', label: 'Dairy & eggs' },
  { id: 'bakery', label: 'Bakery' },
  { id: 'pantry', label: 'Pantry' },
  { id: 'frozen', label: 'Frozen' },
  { id: 'drinks', label: 'Drinks' },
  { id: 'snacks', label: 'Snacks' },
  { id: 'household', label: 'Household' },
  { id: 'other', label: 'Other' },
];

// Words that point to an aisle, checked in this order (so "frozen chicken"
// lands in frozen, not meat).
const WORDS: [Aisle, string[]][] = [
  ['frozen', ['frozen', 'beku', 'ice cream', 'aiskrim', 'nugget', 'sosej', 'sausage', 'fries', 'dumpling']],
  ['household', ['tissue', 'tisu', 'detergent', 'sabun', 'soap', 'shampoo', 'syampu', 'toothpaste', 'ubat gigi', 'bin bag', 'plastik sampah', 'clorox', 'bleach', 'softener', 'pelembut', 'dish', 'pencuci', 'sponge', 'span', 'battery', 'bateri', 'lampu', 'bulb', 'diaper', 'lampin', 'pad', 'foil', 'cling']],
  ['drinks', ['air mineral', 'mineral water', 'water', 'juice', 'jus', 'coffee', 'kopi', 'tea', 'teh', 'milo', 'soda', 'coke', 'sirap', 'cordial', '100plus', 'drink', 'minuman']],
  ['dairy', ['milk', 'susu', 'cheese', 'keju', 'butter', 'mentega', 'yogurt', 'yoghurt', 'egg', 'telur', 'cream', 'krim', 'marjerin', 'margarine']],
  ['bakery', ['bread', 'roti', 'bun', 'croissant', 'cake', 'kek', 'muffin', 'bagel', 'tortilla', 'wrap']],
  ['meat', ['chicken', 'ayam', 'beef', 'daging', 'lamb', 'kambing', 'mutton', 'fish', 'ikan', 'prawn', 'udang', 'sotong', 'squid', 'ketam', 'crab', 'salmon', 'tuna', 'kerang', 'mince', 'bilis', 'anchov*']],
  ['produce', ['apple', 'epal', 'banana', 'pisang', 'orange', 'oren', 'limau', 'lime', 'lemon', 'mango', 'mangga', 'grape', 'anggur', 'watermelon', 'tembikai', 'papaya', 'betik', 'tomato', 'tomat', 'onion', 'bawang', 'garlic', 'ginger', 'halia', 'potato', 'kentang', 'carrot', 'lobak', 'cabbage', 'kobis', 'kubis', 'sayur', 'vegetable', 'veg', 'spinach', 'bayam', 'kangkung', 'sawi', 'salad', 'lettuce', 'cucumber', 'timun', 'chili', 'chilli', 'cili', 'lada', 'serai', 'lemongrass', 'pandan', 'daun', 'herb', 'avocado', 'berry', 'strawberr*', 'buah', 'fruit', 'corn', 'jagung', 'mushroom', 'cendawan', 'tauge', 'beansprout', 'terung', 'brinjal', 'bendi', 'okra', 'kacang panjang']],
  ['snacks', ['chips', 'kerepek', 'biscuit', 'biskut', 'cookie', 'chocolate', 'coklat', 'candy', 'gula-gula', 'popcorn', 'snack', 'keropok', 'nuts', 'kacang']],
  ['pantry', ['rice', 'beras', 'nasi', 'flour', 'tepung', 'sugar', 'gula', 'salt', 'garam', 'oil', 'minyak', 'sauce', 'sos', 'kicap', 'soy', 'vinegar', 'cuka', 'pasta', 'spaghetti', 'noodle', 'mee',  'meehoon', 'bihun', 'kuey teow', 'oat', 'cereal', 'bijirin', 'jam', 'honey', 'madu', 'peanut butter', 'santan', 'coconut milk', 'rempah', 'spice', 'curry', 'kari', 'serbuk', 'powder', 'stock', 'kiub', 'cube', 'canned', 'tin', 'sardin', 'sardine', 'belacan', 'sambal', 'paste', 'pes', 'baking', 'yeast', 'ragi', 'bean', 'lentil', 'dhal', 'dal']],
];

const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A whole word (plural is fine), or the start of a word when it ends with '*' ("strawberr*"). */
function hasWord(text: string, w: string): boolean {
  const prefix = w.endsWith('*');
  const core = esc(prefix ? w.slice(0, -1) : w);
  const re = new RegExp(`(^|[\\s,/(-])${core}${prefix ? '' : '(s|es)?($|[\\s,/)-])'}`);
  return re.test(text);
}

// Names that would otherwise land in the wrong aisle ("coconut milk" isn't dairy).
const FIRST: [Aisle, string[]][] = [
  ['pantry', ['coconut milk', 'santan', 'peanut butter', 'susu pekat', 'condensed milk', 'evaporated milk', 'susu cair']],
];

/** Which aisle an item belongs in, from its name. */
export function aisleFor(name: string): Aisle {
  const t = name.toLowerCase().trim().replace(/\s+/g, ' ');
  for (const [aisle, words] of [...FIRST, ...WORDS]) if (words.some((w) => hasWord(t, w))) return aisle;
  return 'other';
}

/**
 * "2kg beras" → { name: 'beras', qty: '2kg' }, "Milk x2" → { name: 'Milk', qty: 'x2' },
 * "3 tomatoes" → { name: 'tomatoes', qty: '3' }. Anything else stays as typed.
 */
export function splitQty(input: string): { name: string; qty?: string } {
  const s = input.trim().replace(/\s+/g, ' ');
  const lead = s.match(/^(\d+(?:[.,]\d+)?\s?(?:kg|g|l|ml|pcs|pc|biji|bungkus|tin|tray|papan|dozen|pack|packs|x)?)\s+(.+)$/i);
  if (lead) return { name: lead[2], qty: lead[1] };
  const tail = s.match(/^(.+?)\s+(x\s?\d+|\d+(?:[.,]\d+)?\s?(?:kg|g|l|ml|pcs|pc|biji|bungkus|tin|tray|papan|dozen|pack|packs))$/i);
  if (tail) return { name: tail[1], qty: tail[2] };
  return { name: s };
}

/** The list in shop order: aisles in walking order, still-to-buy first, ticked items at the end. */
export function groupForShop(items: GroceryItem[]): { toBuy: { aisle: Aisle; label: string; items: GroceryItem[] }[]; inTrolley: GroceryItem[] } {
  const open = items.filter((i) => !i.done);
  const toBuy = AISLES.map((a) => ({
    aisle: a.id,
    label: a.label,
    items: open.filter((i) => i.aisle === a.id).sort((x, y) => (x.createdMs ?? 0) - (y.createdMs ?? 0)),
  })).filter((g) => g.items.length > 0);
  const inTrolley = items.filter((i) => i.done).sort((x, y) => x.name.localeCompare(y.name));
  return { toBuy, inTrolley };
}

/** Quick picks for an empty or short list. */
export const QUICK_GROCERIES = ['Telur', 'Susu', 'Roti', 'Beras', 'Ayam', 'Bawang', 'Sayur', 'Minyak masak', 'Tisu', 'Air mineral'];
