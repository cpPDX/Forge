# Forge

Forge is a first-person 3D voxel survival-crafting game built with **Three.js** and **Vite**.

The current 0.3 direction is intentionally forge-centered rather than a general-purpose sandbox clone:

> Arrive in a hostile wilderness, establish a forge, improve it, refine deeper materials, craft increasingly capable equipment, survive escalating nights, and push farther underground.

**Core loop:** Explore → extract → return home → refine → forge → survive → push farther.

The active product/engineering roadmap is tracked in [GitHub issue #20](https://github.com/cpPDX/Forge/issues/20).

## Current vertical slice

A fresh world now supports a connected, finishable progression arc:

1. Learn movement, mining, crafting, and building through lightweight contextual objectives.
2. Gather wood and stone and establish a foothold.
3. Build a **Stone Forge** and refine iron with coal.
4. Upgrade to an **Iron Forge** and craft iron equipment.
5. Push deeper for gated resources:
   - Iron: below Y48, Stone Pickaxe+
   - Gold: below Y32, Iron Pickaxe+
   - Diamond: below Y16, Iron Pickaxe+
6. Upgrade to a **Master Forge** and refine diamond.
7. Forge **Forgebrand**, the slice's signature masterwork weapon.
8. Survive escalating nights against Forge-original enemies:
   - **Ashbound** — close-range pursuit
   - **Shardcaster** — ranged pressure
   - **Slagburst** — volatile explosive pressure
9. Complete the final stand during Peak Night pressure: survive 60 seconds and land at least one Forgebrand killing blow.
10. Reach the explicit **THE FORGE HOLDS** completion state, then optionally continue the world.

The target experience is roughly **20–30 minutes** for a competent first-time player after final tuning.

## Run locally

Requirements: a current Node.js installation compatible with Vite 5. CI currently validates on Node 20.

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm test       # Node test suite
npm run build  # production bundle in dist/
npm run preview
```

The only runtime dependency is `three`; Vite is the development/build dependency.

## Controls

### Desktop

| Action | Control |
| --- | --- |
| Move | WASD or arrow keys |
| Look | Mouse |
| Jump | Space |
| Sprint | Shift |
| Sneak | Left Ctrl |
| Break / attack | Hold left mouse; X also breaks |
| Place / interact | Right mouse |
| Inventory | E |
| Flashlight | F |
| Hotbar | 1–9 or mouse wheel |
| Debug overlay | F3 |

The mouse is captured with Pointer Lock during normal desktop play.

### Touch

Coarse-pointer devices use dedicated movement and look zones plus on-screen Jump, Break, Place, Inventory, and Flashlight controls. Moving the virtual stick near its outer range also sprints.

## Architecture at a glance

```text
src/
├── blocks/      block and item definitions
├── game/        Three.js renderer, main loop, orchestration
├── player/      player physics, combat/mining interaction, controls
├── systems/     inventory, crafting, forge/refining, progression, mobs,
│                day/night pressure, saves, drops, and finale state
├── ui/          HUD, inventory rendering, forge/finale/night UI, item sprites
├── utils/       constants and procedural-noise helpers
└── world/       procedural voxel world and chunk meshes
```

`src/main.js` constructs `Game` and layers the focused progression controllers over the core systems. `Game.js` remains the central render/update loop rather than a scene framework.

See [`HANDOFF.md`](./HANDOFF.md) for the current engineering map, state contracts, and implementation notes.

## World and persistence

- Procedural voxel world with 16×16 chunks and 128-block vertical height.
- Forest, desert, snow, and mountain terrain generated from seeded noise.
- Caves and depth-banded coal/iron/gold/diamond generation.
- World modifications are persisted as **sparse edits**, not full generated chunks.
- Player state, inventory, time, first-session progression, forge state, night pressure, and finale completion persist in browser `localStorage`.
- Save key: `forge_3d_v1`; current validated save version: `2`.
- Normal play autosaves periodically, and important progression transitions save immediately.

Saves are local to the browser/device; there is no account/cloud synchronization.

## CI and deployment

`.github/workflows/deploy.yml` runs on pull requests and `main`:

1. `npm ci`
2. `npm test`
3. `npm run build`

Pull requests validate only. Successful pushes to `main` also publish `dist/` through GitHub Pages.

## Current known limitations

- **0.3 tuning is still open:** issue [#29](https://github.com/cpPDX/Forge/issues/29) owns the full fresh-save playtest and 20–30 minute pacing pass.
- **Processed-material visual polish is incomplete:** Iron Ingot, Gold Ingot, and Refined Diamond still need distinct inventory sprites; tracked in [#44](https://github.com/cpPDX/Forge/issues/44).
- Armor/equipment slots are not an implemented gameplay system and are intentionally hidden from the current first-session UI.
- The handheld flashlight is a visual convenience only. Defensive preparation requires placed Torches or Glowstone, which suppress nearby hostile spawns.
- Audio is not currently part of the game.
- The vertical slice deliberately does not include farming, NPC villages, multiplayer, enchantments, large dungeon systems, or a broad endgame tech tree.

## Project history

Forge has gone through materially different prototypes. Older Phaser/Terraria-style and Minecraft-copy handoff documents are **historical**, not current architecture or product guidance. The repository's current source, this README, `HANDOFF.md`, and roadmap issue #20 are the authoritative references for active work.
