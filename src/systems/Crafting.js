import { B, ITEMS } from '../utils/constants.js';

// Hand-crafting recipes only. Metal refining and advanced equipment are owned
// by the Forge system so raw ore cannot bypass progression gates.
const RECIPES = [
  // Wood → Planks
  { ingredients: [{ id: B.OAK_LOG, count: 1 }], result: { id: B.OAK_PLANKS, count: 4 } },
  // Planks → Crafting Table
  { ingredients: [{ id: B.OAK_PLANKS, count: 4 }], result: { id: B.CRAFTING_TABLE, count: 1 } },
  // Stone → Stone Brick
  { ingredients: [{ id: B.COBBLESTONE, count: 4 }], result: { id: B.STONE_BRICK, count: 4 } },
  // Sandstone
  { ingredients: [{ id: B.SAND, count: 4 }], result: { id: B.SANDSTONE, count: 1 } },
  // Processed-material storage blocks. Raw ores cannot be compressed directly.
  { ingredients: [{ id: ITEMS.IRON_INGOT, count: 9 }], result: { id: B.IRON_BLOCK, count: 1 } },
  { ingredients: [{ id: ITEMS.GOLD_INGOT, count: 9 }], result: { id: B.GOLD_BLOCK, count: 1 } },
  { ingredients: [{ id: ITEMS.REFINED_DIAMOND, count: 9 }], result: { id: B.DIAMOND_BLOCK, count: 1 } },
  // Glass
  { ingredients: [{ id: B.SAND, count: 1 }], result: { id: B.GLASS, count: 1 } },
  // Snow block
  { ingredients: [{ id: B.SNOW, count: 4 }], result: { id: B.SNOW_BLOCK, count: 1 } },
  // Stone Forge base structure (B.FURNACE is retained as the save-compatible block ID).
  { ingredients: [{ id: B.COBBLESTONE, count: 8 }], result: { id: B.FURNACE, count: 1 } },
  // ── Sticks ───────────────────────────────────────────────────────────────
  { ingredients: [{ id: B.OAK_PLANKS, count: 2 }], result: { id: ITEMS.STICK, count: 4 } },
  // ── Torches ──────────────────────────────────────────────────────────────
  { ingredients: [{ id: B.COAL_ORE, count: 1 }, { id: ITEMS.STICK, count: 1 }], result: { id: B.TORCH, count: 4 } },
  // ── Basic pickaxes ───────────────────────────────────────────────────────
  { ingredients: [{ id: B.OAK_PLANKS,  count: 3 }, { id: ITEMS.STICK, count: 2 }], result: { id: ITEMS.WOODEN_PICKAXE, count: 1 } },
  { ingredients: [{ id: B.COBBLESTONE, count: 3 }, { id: ITEMS.STICK, count: 2 }], result: { id: ITEMS.STONE_PICKAXE, count: 1 } },
  // ── Basic weapons ────────────────────────────────────────────────────────
  { ingredients: [{ id: B.OAK_PLANKS,  count: 2 }, { id: ITEMS.STICK, count: 1 }], result: { id: ITEMS.WOODEN_SWORD, count: 1 } },
  { ingredients: [{ id: B.COBBLESTONE, count: 2 }, { id: ITEMS.STICK, count: 1 }], result: { id: ITEMS.STONE_SWORD, count: 1 } },
];

export class Crafting {
  available(inventory) {
    return RECIPES.filter(r => r.ingredients.every(ing => inventory.countOf(ing.id) >= ing.count));
  }

  _craftRecipe(recipe, inventory) {
    if (!recipe) return false;
    if (!recipe.ingredients.every(ing => inventory.countOf(ing.id) >= ing.count)) return false;

    const before = inventory.serialize();
    for (const ing of recipe.ingredients) {
      if (!inventory.removeItem(ing.id, ing.count)) {
        inventory.load(before);
        return false;
      }
    }

    const overflow = inventory.addItem(recipe.result.id, recipe.result.count);
    if (overflow > 0) {
      inventory.load(before);
      return false;
    }
    return true;
  }

  craft(recipeIdx, inventory) {
    const recipe = this.available(inventory)[recipeIdx];
    return this._craftRecipe(recipe, inventory);
  }

  craftByIndex(idx, inventory) {
    return this._craftRecipe(RECIPES[idx], inventory);
  }

  allRecipes() { return RECIPES; }
}
