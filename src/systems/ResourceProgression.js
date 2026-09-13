import { B, ITEMS } from '../utils/constants.js';

export const TOOL_TIERS = {
  NONE: 0,
  WOOD: 1,
  STONE: 2,
  IRON: 3,
  DIAMOND: 4,
};

const TOOL_TIER_BY_ITEM = new Map([
  [ITEMS.WOODEN_PICKAXE, TOOL_TIERS.WOOD],
  [ITEMS.STONE_PICKAXE, TOOL_TIERS.STONE],
  [ITEMS.IRON_PICKAXE, TOOL_TIERS.IRON],
  [ITEMS.DIAMOND_PICKAXE, TOOL_TIERS.DIAMOND],
]);

const TIER_NAMES = {
  [TOOL_TIERS.WOOD]: 'Wooden Pickaxe',
  [TOOL_TIERS.STONE]: 'Stone Pickaxe',
  [TOOL_TIERS.IRON]: 'Iron Pickaxe',
  [TOOL_TIERS.DIAMOND]: 'Diamond Pickaxe',
};

const HARVEST_RULES = new Map([
  // Tier 1 establishes the stone/coal economy.
  [B.STONE,        { tool: 'pickaxe', tier: TOOL_TIERS.WOOD }],
  [B.COBBLESTONE,  { tool: 'pickaxe', tier: TOOL_TIERS.WOOD }],
  [B.COAL_ORE,     { tool: 'pickaxe', tier: TOOL_TIERS.WOOD }],
  [B.SANDSTONE,    { tool: 'pickaxe', tier: TOOL_TIERS.WOOD }],
  [B.FURNACE,      { tool: 'pickaxe', tier: TOOL_TIERS.WOOD }],
  [B.STONE_BRICK,  { tool: 'pickaxe', tier: TOOL_TIERS.WOOD }],

  // Tier 2 unlocks the material needed to advance the forge.
  [B.IRON_ORE,     { tool: 'pickaxe', tier: TOOL_TIERS.STONE }],
  [B.IRON_BLOCK,   { tool: 'pickaxe', tier: TOOL_TIERS.STONE }],

  // Tier 3 is produced by the Iron Forge and unlocks late-slice materials.
  [B.GOLD_ORE,     { tool: 'pickaxe', tier: TOOL_TIERS.IRON }],
  [B.DIAMOND_ORE,  { tool: 'pickaxe', tier: TOOL_TIERS.IRON }],
  [B.GOLD_BLOCK,   { tool: 'pickaxe', tier: TOOL_TIERS.IRON }],
  [B.DIAMOND_BLOCK,{ tool: 'pickaxe', tier: TOOL_TIERS.IRON }],
]);

export function toolTierForItem(itemId) {
  return TOOL_TIER_BY_ITEM.get(itemId) ?? TOOL_TIERS.NONE;
}

export function harvestRequirement(blockId) {
  const rule = HARVEST_RULES.get(blockId);
  if (!rule) return null;
  return {
    ...rule,
    name: TIER_NAMES[rule.tier],
  };
}

export function canHarvest(blockId, heldItemId) {
  const requirement = HARVEST_RULES.get(blockId);
  if (!requirement) return true;
  if (requirement.tool !== 'pickaxe') return false;
  return toolTierForItem(heldItemId) >= requirement.tier;
}

export const RESOURCE_LEADS = {
  iron: {
    label: 'Iron',
    maxY: 47,
    toolTier: TOOL_TIERS.STONE,
    toolName: TIER_NAMES[TOOL_TIERS.STONE],
    hint: 'Iron veins form below Y48. Bring a Stone Pickaxe.',
  },
  gold: {
    label: 'Gold',
    maxY: 31,
    toolTier: TOOL_TIERS.IRON,
    toolName: TIER_NAMES[TOOL_TIERS.IRON],
    hint: 'Gold veins form below Y32. Bring an Iron Pickaxe.',
  },
  diamond: {
    label: 'Diamond',
    maxY: 15,
    toolTier: TOOL_TIERS.IRON,
    toolName: TIER_NAMES[TOOL_TIERS.IRON],
    hint: 'Diamond veins form below Y16. Bring an Iron Pickaxe.',
  },
};
