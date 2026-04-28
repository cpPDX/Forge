import { RecipeRegistry } from '../utils/RecipeRegistry.js';
import { ItemRegistry } from '../utils/ItemRegistry.js';

export class CraftingSystem {
  constructor(inventory) {
    this.inventory = inventory;
  }

  getAvailable(station) {
    return RecipeRegistry.getForStation(station).filter(r => {
      if (r.type === 'smelting') {
        return this.inventory.hasItem(r.input, 1) && this.inventory.hasItem(r.fuel, 1);
      }
      return r.ingredients.every(ing => this.inventory.hasItem(ing.itemId, ing.count));
    });
  }

  craft(recipeId) {
    const recipe = RecipeRegistry.getAll().find(r => r.id === recipeId);
    if (!recipe) return false;

    if (recipe.type === 'smelting') {
      if (!this.inventory.hasItem(recipe.input, 1)) return false;
      if (!this.inventory.hasItem(recipe.fuel, 1))  return false;
      this.inventory.removeItem(recipe.input, 1);
      this.inventory.removeItem(recipe.fuel, 1);
    } else {
      for (const ing of recipe.ingredients) {
        if (!this.inventory.hasItem(ing.itemId, ing.count)) return false;
      }
      for (const ing of recipe.ingredients) {
        this.inventory.removeItem(ing.itemId, ing.count);
      }
    }

    this.inventory.addItem(recipe.result.itemId, recipe.result.count);
    return true;
  }
}
