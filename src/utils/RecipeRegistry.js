const recipes = [];
let _id = 0;

function shaped(station, pattern, ingredients, result) {
  recipes.push({ id: _id++, type: 'shaped', station, pattern, ingredients, result });
}
function shapeless(station, ingredients, result) {
  recipes.push({ id: _id++, type: 'shapeless', station, ingredients, result });
}
function smelting(input, fuel, result, time = 10000) {
  recipes.push({ id: _id++, type: 'smelting', station: 'furnace', input, fuel, result, time });
}

// Hand recipes (station = null)
shapeless(null, [{ itemId: 'oak_log', count: 1 }],    { itemId: 'oak_planks',     count: 4 });
shapeless(null, [{ itemId: 'pine_log', count: 1 }],   { itemId: 'pine_planks',    count: 4 });
shapeless(null, [{ itemId: 'jungle_log', count: 1 }], { itemId: 'pine_planks',    count: 4 });
shapeless(null, [{ itemId: 'oak_planks', count: 2 }], { itemId: 'stick',          count: 4 });
shapeless(null, [{ itemId: 'pine_planks', count: 2 }],{ itemId: 'stick',          count: 4 });
shapeless(null, [{ itemId: 'coal', count: 1 }, { itemId: 'stick', count: 1 }], { itemId: 'torch', count: 4 });
shapeless(null, [{ itemId: 'oak_planks', count: 4 }], { itemId: 'crafting_table', count: 1 });
shapeless(null, [{ itemId: 'pine_planks', count: 4 }],{ itemId: 'crafting_table', count: 1 });

// Crafting table recipes
shapeless('crafting_table', [{ itemId: 'cobblestone', count: 8 }], { itemId: 'furnace',       count: 1 });
shapeless('crafting_table', [{ itemId: 'oak_planks',  count: 8 }], { itemId: 'chest',         count: 1 });
shapeless('crafting_table', [{ itemId: 'pine_planks', count: 8 }], { itemId: 'chest',         count: 1 });
shapeless('crafting_table', [{ itemId: 'cobblestone', count: 6 }, { itemId: 'stick', count: 2 }], { itemId: 'stone_brick', count: 4 });
shapeless('crafting_table', [{ itemId: 'sand',        count: 4 }], { itemId: 'glass',         count: 1 });
shapeless('crafting_table', [{ itemId: 'iron_ingot',  count: 9 }], { itemId: 'iron_block',    count: 1 });
shapeless('crafting_table', [{ itemId: 'gold_ingot',  count: 9 }], { itemId: 'gold_block',    count: 1 });
shapeless('crafting_table', [{ itemId: 'diamond',     count: 9 }], { itemId: 'diamond_block', count: 1 });

// Tools — wood
shapeless('crafting_table', [{ itemId: 'oak_planks', count: 3 }, { itemId: 'stick', count: 2 }], { itemId: 'wood_pickaxe', count: 1 });
shapeless('crafting_table', [{ itemId: 'oak_planks', count: 3 }, { itemId: 'stick', count: 2 }], { itemId: 'wood_axe',     count: 1 });
shapeless('crafting_table', [{ itemId: 'oak_planks', count: 1 }, { itemId: 'stick', count: 2 }], { itemId: 'wood_shovel',  count: 1 });
shapeless('crafting_table', [{ itemId: 'oak_planks', count: 2 }, { itemId: 'stick', count: 1 }], { itemId: 'wood_sword',   count: 1 });

// Tools — stone
shapeless('crafting_table', [{ itemId: 'cobblestone', count: 3 }, { itemId: 'stick', count: 2 }], { itemId: 'stone_pickaxe', count: 1 });
shapeless('crafting_table', [{ itemId: 'cobblestone', count: 3 }, { itemId: 'stick', count: 2 }], { itemId: 'stone_axe',     count: 1 });
shapeless('crafting_table', [{ itemId: 'cobblestone', count: 1 }, { itemId: 'stick', count: 2 }], { itemId: 'stone_shovel',  count: 1 });
shapeless('crafting_table', [{ itemId: 'cobblestone', count: 2 }, { itemId: 'stick', count: 1 }], { itemId: 'stone_sword',   count: 1 });

// Tools — iron
shapeless('crafting_table', [{ itemId: 'iron_ingot', count: 3 }, { itemId: 'stick', count: 2 }], { itemId: 'iron_pickaxe', count: 1 });
shapeless('crafting_table', [{ itemId: 'iron_ingot', count: 3 }, { itemId: 'stick', count: 2 }], { itemId: 'iron_axe',     count: 1 });
shapeless('crafting_table', [{ itemId: 'iron_ingot', count: 1 }, { itemId: 'stick', count: 2 }], { itemId: 'iron_shovel',  count: 1 });
shapeless('crafting_table', [{ itemId: 'iron_ingot', count: 2 }, { itemId: 'stick', count: 1 }], { itemId: 'iron_sword',   count: 1 });

// Tools — gold
shapeless('crafting_table', [{ itemId: 'gold_ingot', count: 3 }, { itemId: 'stick', count: 2 }], { itemId: 'gold_pickaxe', count: 1 });
shapeless('crafting_table', [{ itemId: 'gold_ingot', count: 2 }, { itemId: 'stick', count: 1 }], { itemId: 'gold_sword',   count: 1 });

// Tools — diamond
shapeless('crafting_table', [{ itemId: 'diamond', count: 3 }, { itemId: 'stick', count: 2 }], { itemId: 'diamond_pickaxe', count: 1 });
shapeless('crafting_table', [{ itemId: 'diamond', count: 3 }, { itemId: 'stick', count: 2 }], { itemId: 'diamond_axe',     count: 1 });
shapeless('crafting_table', [{ itemId: 'diamond', count: 2 }, { itemId: 'stick', count: 1 }], { itemId: 'diamond_sword',   count: 1 });

// Smelting
smelting('iron_ore',  'coal', 'iron_ingot');
smelting('gold_ore',  'coal', 'gold_ingot');
smelting('sand',      'coal', 'glass');
smelting('raw_pork',  'coal', 'cooked_pork');
smelting('raw_meat',  'coal', 'cooked_meat');
smelting('raw_fish',  'coal', 'cooked_fish');

export const RecipeRegistry = {
  getAll()               { return recipes; },
  getForStation(station) { return recipes.filter(r => r.station === station); },
  findMatch(station, getCount) {
    return recipes.find(r => {
      if (r.station !== station) return false;
      if (r.type === 'smelting') {
        return getCount(r.input) >= 1 && getCount(r.fuel) >= 1;
      }
      return r.ingredients.every(ing => getCount(ing.itemId) >= ing.count);
    }) || null;
  },
};
