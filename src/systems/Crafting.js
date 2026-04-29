import { B, ITEMS } from '../utils/constants.js';

// Shapeless recipes: { ingredients: [{id,count}], result: {id,count} }
const RECIPES = [
  // Wood → Planks
  { ingredients: [{ id: B.OAK_LOG, count: 1 }], result: { id: B.OAK_PLANKS, count: 4 } },
  // Planks → Sticks (no stick item — use planks as stand-in)
  // Planks → Crafting Table
  { ingredients: [{ id: B.OAK_PLANKS, count: 4 }], result: { id: B.CRAFTING_TABLE, count: 1 } },
  // Stone → Stone Brick
  { ingredients: [{ id: B.COBBLESTONE, count: 4 }], result: { id: B.STONE_BRICK, count: 4 } },
  // Sand + Gravel → Sandstone
  { ingredients: [{ id: B.SAND, count: 4 }], result: { id: B.SANDSTONE, count: 1 } },
  // Iron nuggets → Iron Block
  { ingredients: [{ id: B.IRON_ORE, count: 9 }], result: { id: B.IRON_BLOCK, count: 1 } },
  { ingredients: [{ id: B.GOLD_ORE, count: 9 }], result: { id: B.GOLD_BLOCK, count: 1 } },
  { ingredients: [{ id: B.DIAMOND_ORE, count: 9 }], result: { id: B.DIAMOND_BLOCK, count: 1 } },
  // Glass
  { ingredients: [{ id: B.SAND, count: 1 }], result: { id: B.GLASS, count: 1 } },
  // Snow block
  { ingredients: [{ id: B.SNOW, count: 4 }], result: { id: B.SNOW_BLOCK, count: 1 } },
  // Furnace
  { ingredients: [{ id: B.COBBLESTONE, count: 8 }], result: { id: B.FURNACE, count: 1 } },
  // ── Weapons ──────────────────────────────────────────────────────────────
  // 2 Oak Planks → Wooden Sword
  { ingredients: [{ id: B.OAK_PLANKS, count: 2 }], result: { id: ITEMS.WOODEN_SWORD, count: 1 } },
  // 2 Cobblestone → Stone Sword
  { ingredients: [{ id: B.COBBLESTONE, count: 2 }], result: { id: ITEMS.STONE_SWORD, count: 1 } },
  // 2 Iron Ore → Iron Sword
  { ingredients: [{ id: B.IRON_ORE, count: 2 }], result: { id: ITEMS.IRON_SWORD, count: 1 } },
  // 2 Diamond Ore → Diamond Sword
  { ingredients: [{ id: B.DIAMOND_ORE, count: 2 }], result: { id: ITEMS.DIAMOND_SWORD, count: 1 } },
];

export class Crafting {
  // Returns array of craftable recipes given inventory
  available(inventory) {
    return RECIPES.filter(r => r.ingredients.every(ing => inventory.countOf(ing.id) >= ing.count));
  }

  // Attempt to craft recipe at index in available list; returns true on success
  craft(recipeIdx, inventory) {
    const avail = this.available(inventory);
    const recipe = avail[recipeIdx];
    if (!recipe) return false;

    for (const ing of recipe.ingredients) {
      if (!inventory.removeItem(ing.id, ing.count)) return false;
    }
    inventory.addItem(recipe.result.id, recipe.result.count);
    return true;
  }

  allRecipes() { return RECIPES; }
}
