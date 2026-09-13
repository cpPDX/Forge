import { B, ITEMS } from '../utils/constants.js';
import { MAX_STACK } from './Inventory.js';

export const FORGE_TIERS = {
  STONE: 1,
  IRON: 2,
  MASTER: 3,
};

const TIER_DEFS = {
  [FORGE_TIERS.STONE]: {
    name: 'Stone Forge',
    capability: 'Refine iron with coal.',
  },
  [FORGE_TIERS.IRON]: {
    name: 'Iron Forge',
    capability: 'Forge iron equipment and refine gold.',
    upgradeFromPrevious: [
      { id: ITEMS.IRON_INGOT, count: 6 },
      { id: B.COBBLESTONE, count: 4 },
    ],
  },
  [FORGE_TIERS.MASTER]: {
    name: 'Master Forge',
    capability: 'Refine diamond and forge the Forgebrand masterwork.',
    upgradeFromPrevious: [
      { id: ITEMS.GOLD_INGOT, count: 4 },
      { id: ITEMS.IRON_INGOT, count: 4 },
      { id: B.DIAMOND_ORE, count: 2 },
    ],
  },
};

const REFINE_RECIPES = [
  {
    id: 'iron',
    name: 'Refine Iron',
    minTier: FORGE_TIERS.STONE,
    input: { id: B.IRON_ORE, count: 1 },
    fuel: { id: B.COAL_ORE, count: 1 },
    output: { id: ITEMS.IRON_INGOT, count: 1 },
    duration: 4,
  },
  {
    id: 'gold',
    name: 'Refine Gold',
    minTier: FORGE_TIERS.IRON,
    input: { id: B.GOLD_ORE, count: 1 },
    fuel: { id: B.COAL_ORE, count: 1 },
    output: { id: ITEMS.GOLD_INGOT, count: 1 },
    duration: 5,
  },
  {
    id: 'diamond',
    name: 'Refine Diamond',
    minTier: FORGE_TIERS.MASTER,
    input: { id: B.DIAMOND_ORE, count: 1 },
    fuel: { id: B.COAL_ORE, count: 1 },
    output: { id: ITEMS.REFINED_DIAMOND, count: 1 },
    duration: 6,
  },
];

const FORGE_CRAFTS = [
  {
    id: 'iron-pickaxe',
    name: 'Iron Pickaxe',
    minTier: FORGE_TIERS.IRON,
    ingredients: [
      { id: ITEMS.IRON_INGOT, count: 3 },
      { id: ITEMS.STICK, count: 2 },
    ],
    result: { id: ITEMS.IRON_PICKAXE, count: 1 },
  },
  {
    id: 'iron-sword',
    name: 'Iron Sword',
    minTier: FORGE_TIERS.IRON,
    ingredients: [
      { id: ITEMS.IRON_INGOT, count: 2 },
      { id: ITEMS.STICK, count: 1 },
    ],
    result: { id: ITEMS.IRON_SWORD, count: 1 },
  },
  {
    id: 'diamond-pickaxe',
    name: 'Diamond Pickaxe',
    minTier: FORGE_TIERS.MASTER,
    ingredients: [
      { id: ITEMS.REFINED_DIAMOND, count: 3 },
      { id: ITEMS.STICK, count: 2 },
    ],
    result: { id: ITEMS.DIAMOND_PICKAXE, count: 1 },
  },
  {
    id: 'forgebrand',
    name: 'Forgebrand',
    minTier: FORGE_TIERS.MASTER,
    ingredients: [
      { id: ITEMS.REFINED_DIAMOND, count: 2 },
      { id: ITEMS.GOLD_INGOT, count: 2 },
      { id: ITEMS.IRON_INGOT, count: 2 },
      { id: ITEMS.STICK, count: 1 },
    ],
    result: { id: ITEMS.FORGEBRAND, count: 1 },
  },
];

const REFINE_BY_ID = new Map(REFINE_RECIPES.map(recipe => [recipe.id, recipe]));
const CRAFT_BY_ID = new Map(FORGE_CRAFTS.map(recipe => [recipe.id, recipe]));

function stationKey(pos) {
  if (!Array.isArray(pos) || pos.length !== 3 || !pos.every(Number.isInteger)) {
    throw new Error('Invalid forge position');
  }
  return `${pos[0]},${pos[1]},${pos[2]}`;
}

function parseStationKey(key) {
  const parts = String(key).split(',').map(Number);
  if (parts.length !== 3 || !parts.every(Number.isInteger)) throw new Error(`Invalid forge key: ${key}`);
  return parts;
}

function cloneStack(stack) {
  return stack ? { id: stack.id, count: stack.count } : null;
}

function hasIngredients(inventory, ingredients) {
  return ingredients.every(item => inventory.countOf(item.id) >= item.count);
}

function consumeIngredients(inventory, ingredients) {
  if (!hasIngredients(inventory, ingredients)) return false;
  const before = inventory.serialize();
  for (const item of ingredients) {
    if (!inventory.removeItem(item.id, item.count)) {
      inventory.load(before);
      return false;
    }
  }
  return true;
}

function mergeSalvage(stacks) {
  const totals = new Map();
  for (const stack of stacks) {
    if (!stack || stack.count <= 0) continue;
    totals.set(stack.id, (totals.get(stack.id) ?? 0) + stack.count);
  }
  return [...totals.entries()].map(([id, count]) => ({ id, count }));
}

export class ForgeSystem {
  constructor() {
    this._stations = new Map();
  }

  ensureStation(pos) {
    const key = stationKey(pos);
    if (!this._stations.has(key)) {
      this._stations.set(key, { tier: FORGE_TIERS.STONE, job: null, output: null });
    }
    return this._stations.get(key);
  }

  station(pos) {
    const state = this.ensureStation(pos);
    return {
      tier: state.tier,
      tierName: TIER_DEFS[state.tier].name,
      capability: TIER_DEFS[state.tier].capability,
      job: state.job ? { ...state.job } : null,
      output: cloneStack(state.output),
    };
  }

  tierDefinition(tier) {
    return TIER_DEFS[tier] ? { ...TIER_DEFS[tier] } : null;
  }

  hasTier(tier) {
    if (!Number.isInteger(tier) || !TIER_DEFS[tier]) return false;
    return [...this._stations.values()].some(state => state.tier >= tier);
  }

  refiningOptions(pos) {
    const tier = this.ensureStation(pos).tier;
    return REFINE_RECIPES.filter(recipe => recipe.minTier <= tier).map(recipe => ({
      ...recipe,
      input: { ...recipe.input },
      fuel: { ...recipe.fuel },
      output: { ...recipe.output },
    }));
  }

  craftingOptions(pos) {
    const tier = this.ensureStation(pos).tier;
    return FORGE_CRAFTS.filter(recipe => recipe.minTier <= tier).map(recipe => ({
      ...recipe,
      ingredients: recipe.ingredients.map(item => ({ ...item })),
      result: { ...recipe.result },
    }));
  }

  nextUpgrade(pos) {
    const tier = this.ensureStation(pos).tier;
    if (tier >= FORGE_TIERS.MASTER) return null;
    const nextTier = tier + 1;
    return {
      tier: nextTier,
      name: TIER_DEFS[nextTier].name,
      requirements: TIER_DEFS[nextTier].upgradeFromPrevious.map(item => ({ ...item })),
      capability: TIER_DEFS[nextTier].capability,
    };
  }

  upgrade(pos, inventory) {
    const state = this.ensureStation(pos);
    const upgrade = this.nextUpgrade(pos);
    if (!upgrade || !hasIngredients(inventory, upgrade.requirements)) return false;
    if (!consumeIngredients(inventory, upgrade.requirements)) return false;
    state.tier = upgrade.tier;
    return true;
  }

  startRefining(pos, recipeId, inventory) {
    const state = this.ensureStation(pos);
    const recipe = REFINE_BY_ID.get(recipeId);
    if (!recipe || recipe.minTier > state.tier || state.job) return false;

    if (state.output && (state.output.id !== recipe.output.id || state.output.count + recipe.output.count > MAX_STACK)) {
      return false;
    }

    if (!consumeIngredients(inventory, [recipe.input, recipe.fuel])) return false;

    state.job = {
      recipeId: recipe.id,
      progress: 0,
      duration: recipe.duration,
    };
    return true;
  }

  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return false;
    let completed = false;

    for (const state of this._stations.values()) {
      if (!state.job) continue;
      const recipe = REFINE_BY_ID.get(state.job.recipeId);
      if (!recipe) {
        state.job = null;
        continue;
      }

      state.job.progress = Math.min(state.job.duration, state.job.progress + dt);
      if (state.job.progress < state.job.duration) continue;

      if (!state.output) state.output = { ...recipe.output };
      else state.output.count += recipe.output.count;
      state.job = null;
      completed = true;
    }

    return completed;
  }

  collectOutput(pos, inventory) {
    const state = this.ensureStation(pos);
    if (!state.output) return 0;
    const accepted = state.output.count - inventory.addItem(state.output.id, state.output.count);
    state.output.count -= accepted;
    if (state.output.count <= 0) state.output = null;
    return accepted;
  }

  craft(pos, recipeId, inventory) {
    const state = this.ensureStation(pos);
    const recipe = CRAFT_BY_ID.get(recipeId);
    if (!recipe || recipe.minTier > state.tier || !hasIngredients(inventory, recipe.ingredients)) return false;

    const before = inventory.serialize();
    if (!consumeIngredients(inventory, recipe.ingredients)) return false;
    const overflow = inventory.addItem(recipe.result.id, recipe.result.count);
    if (overflow > 0) {
      inventory.load(before);
      return false;
    }
    return true;
  }

  removeStation(pos) {
    const key = stationKey(pos);
    const state = this._stations.get(key);
    if (!state) return [];

    const salvage = [];
    if (state.output) salvage.push({ ...state.output });
    if (state.job) {
      const recipe = REFINE_BY_ID.get(state.job.recipeId);
      if (recipe) salvage.push({ ...recipe.input }, { ...recipe.fuel });
    }

    this._stations.delete(key);
    return mergeSalvage(salvage);
  }

  serialize() {
    const stations = {};
    for (const [key, state] of this._stations) {
      stations[key] = {
        tier: state.tier,
        job: state.job ? { ...state.job } : null,
        output: cloneStack(state.output),
      };
    }
    return { stations };
  }

  load(data, world = null) {
    this._stations.clear();
    if (!data?.stations || typeof data.stations !== 'object' || Array.isArray(data.stations)) return;

    const parsed = [];
    for (const [key, raw] of Object.entries(data.stations)) {
      const pos = parseStationKey(key);
      if (!raw || typeof raw !== 'object') throw new Error(`Invalid forge state for ${key}`);
      if (!Number.isInteger(raw.tier) || !TIER_DEFS[raw.tier]) throw new Error(`Invalid forge tier for ${key}`);

      let job = null;
      if (raw.job != null) {
        const recipe = REFINE_BY_ID.get(raw.job.recipeId);
        if (!recipe || recipe.minTier > raw.tier) throw new Error(`Invalid forge job for ${key}`);
        if (!Number.isFinite(raw.job.progress) || raw.job.progress < 0 || raw.job.progress > recipe.duration) {
          throw new Error(`Invalid forge job progress for ${key}`);
        }
        job = { recipeId: recipe.id, progress: raw.job.progress, duration: recipe.duration };
      }

      let output = null;
      if (raw.output != null) {
        if (!Number.isInteger(raw.output.id) || !Number.isInteger(raw.output.count)
          || raw.output.count <= 0 || raw.output.count > MAX_STACK) {
          throw new Error(`Invalid forge output for ${key}`);
        }
        output = { id: raw.output.id, count: raw.output.count };
      }

      if (world && world.getBlock(...pos) !== B.FURNACE) continue;
      parsed.push([key, { tier: raw.tier, job, output }]);
    }

    for (const [key, state] of parsed) this._stations.set(key, state);
  }
}
