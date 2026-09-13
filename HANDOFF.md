# Forge — Current Engineering Handoff

> **Status:** current as of the Forge 0.3 vertical-slice implementation.
>
> This file replaces the obsolete Phaser/2D/Terraria-style handoff. If another document in this repository conflicts with this one, prefer the current source code, this handoff, `README.md`, and roadmap issue [#20](https://github.com/cpPDX/Forge/issues/20).

## Product intent

Forge is a **Three.js first-person 3D voxel survival-crafting game**. The active 0.3 product direction is not “build a smaller Minecraft.” The differentiating loop is the forge itself:

**Explore → extract → return home → refine → forge → survive → push farther**

The implemented vertical slice now has a beginning, progression arc, escalating survival pressure, and explicit ending:

- lightweight first-session guidance
- Stone → Iron → Master Forge progression
- ore refining and processed materials
- depth/tool-gated mining
- escalating Night 1 / Night 2 / Night 3+ pressure
- Forge-original Ashbound, Shardcaster, and Slagburst enemies
- Forgebrand masterwork weapon
- Peak Night final stand
- persisted `THE FORGE HOLDS` completion state

Issue #29 owns final end-to-end playtesting and pacing/tuning before expanding the sandbox.

---

## Stack

- **Runtime:** browser JavaScript ES modules
- **3D:** `three ^0.163.0`
- **Build/dev server:** `vite ^5.4.0`
- **Tests:** Node's built-in `node:test`
- **Persistence:** browser `localStorage`
- **Deployment:** GitHub Pages through `.github/workflows/deploy.yml`

There is no Phaser runtime in the current game.

### Local commands

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

CI uses `npm ci`, `npm test`, and `npm run build` on both pull requests and `main`. GitHub Pages deployment runs only from successful `main` builds.

---

## Current source map

```text
src/
├── main.js
├── blocks/
│   ├── BlockRegistry.js
│   └── ItemRegistry.js
├── game/
│   └── Game.js
├── player/
│   ├── Controls.js
│   └── Player.js
├── systems/
│   ├── Crafting.js
│   ├── DropSystem.js
│   ├── EnemyIdentity.js
│   ├── FinaleController.js
│   ├── FinaleSystem.js
│   ├── FirstSessionController.js
│   ├── FirstSessionGuide.js
│   ├── ForgeController.js
│   ├── ForgeSystem.js
│   ├── Inventory.js
│   ├── MobSystem.js
│   ├── NightPressureController.js
│   ├── NightPressureSystem.js
│   ├── ResourceProgression.js
│   ├── ResourceProgressionController.js
│   ├── SaveManager.js
│   └── TimeSystem.js
├── ui/
│   ├── FinaleView.js
│   ├── FirstSessionGuideView.js
│   ├── ForgeView.js
│   ├── HUD.js
│   ├── ItemSprites.js
│   ├── NightPressureView.js
│   └── PlayerPreview.js
├── utils/
│   ├── constants.js
│   └── noise.js
└── world/
    ├── ChunkMesh.js
    └── World.js
```

The architecture is intentionally small. `Game` owns the core renderer/world/player/inventory/time/mob loop. Focused controllers layer progression behavior over those core systems instead of turning `Game.js` into a large quest/progression class.

---

## Startup and controller composition

`src/main.js` currently initializes in this order:

1. `new Game(canvas)`
2. connect mob loot to the existing `DropSystem`
3. `FirstSessionController`
4. `ForgeController`
5. `ResourceProgressionController`
6. `NightPressureController`
7. `FinaleController`
8. `game.start()`

Several controllers wrap existing methods (`SaveManager.save`, `MobSystem.update`, player interactions) to keep changes incremental. **Order matters.** When adding another wrapper:

- delegate to the previously bound implementation rather than replacing the whole path
- preserve incoming state with object spread when extending saves
- do not bypass first-session hostile protection or night-pressure configuration
- add focused composition/regression tests for cross-system behavior

This is pragmatic for the current small project, but if controller interception grows materially beyond the 0.3 slice, introduce explicit events/hooks rather than stacking more wrappers indefinitely.

---

## Core game loop

`Game._loop()`:

1. polls controls
2. skips gameplay logic while the game is in a paused/dead state
3. processes inventory/flashlight/hotbar one-shots
4. updates `Player`
5. detects death
6. resolves interactive block requests
7. updates targeted-block HUD
8. updates floating drops
9. streams/remeshes chunks as needed
10. updates outline/flashlight
11. updates mobs (through progression wrappers)
12. advances time/lighting
13. updates HUD/debug state
14. autosaves periodically
15. renders the Three.js scene

Keep gameplay timing in seconds using `dt`; avoid frame-count-dependent mechanics.

---

## World generation

Important constants in `src/utils/constants.js`:

- chunk width/depth: **16 blocks**
- vertical world height: **128 blocks**
- sea level: **64**
- render distance: **5 chunks** in each direction
- full day/night cycle: **12 minutes**

`World` uses seeded 2D/3D FBM noise for terrain, biomes, caves, and ores. Current terrain biomes are forest, desert, snow, and mountains.

The fresh-spawn search deliberately chooses a nearby reasonably flat forest/mountain location so the first-session loop has accessible wood.

### Ore bands used by 0.3 progression

- Coal: below Y64
- Iron: below Y48; requires Stone Pickaxe+
- Gold: below Y32; requires Iron Pickaxe+
- Diamond: below Y16; requires Iron Pickaxe+

Ore tiers are evaluated rare/deep first so common coal cannot shadow rarer material. The fixed 0.3 seed has a regression test requiring useful ore headroom around spawn. Diamond's current noise cutoff is `> 0.92`; this was tuned because the previous `> 0.93` made nearby diamond mathematically absent for the intended progression footprint.

### World edits

Procedural chunks are regenerated from the seed. Player changes are persisted as **sparse block edits** rather than serializing every generated chunk. Legacy full-chunk saves can migrate into sparse edits.

Do not revert to storing full generated chunks unless there is a demonstrated need; it unnecessarily inflates localStorage and complicates migration.

---

## Block and item identity invariants

IDs in `src/utils/constants.js` are save data. **Never reorder or silently reuse numeric IDs.**

Two compatibility decisions are especially important:

- `B.FURNACE` remains numeric block ID **25**, but the 0.3 game presents/uses it as the **Stone Forge** base station.
- item ID **103** is now **Forgebrand**. `ITEMS.DIAMOND_SWORD` remains only as a legacy symbolic alias to the same numeric ID so old saves do not lose their top-tier weapon.

When changing saved identity, prefer migration or a compatible alias over breaking existing local saves.

---

## First-session progression

`FirstSessionGuide` / `FirstSessionController` teach the real progression loop through play rather than a separate tutorial level.

Fresh saves begin with an empty inventory rather than the old generous starter kit. Current path:

1. move + look + jump
2. gather Oak Logs
3. open Inventory / Hand Crafting
4. make Planks
5. make Sticks
6. craft Wooden Pickaxe
7. equip it
8. mine stone
9. place a block / establish foothold
10. build the first Stone Forge

If fundamentals are completed after dark, hostiles remain suppressed until daylight so the tutorial cannot suddenly release enemies on top of the player. Protected tutorial nights do **not** consume Night 1 progression.

Opening the first Stone Forge ends the persistent onboarding card and hands progression to the forge UI/objective systems.

---

## Crafting and forge progression

### Hand crafting

Hand crafting is intentionally limited to basic survival/building recipes. It must not provide a back door around forge tiers or refining.

Notably:

- raw metal ore cannot become finished metal equipment directly
- advanced weapons/tools are forge-only
- `8 Cobblestone → Stone Forge` is part of the discoverable first-session path

Craft operations are transactional: if ingredients or output capacity fail, inventory state rolls back rather than deleting/duplicating resources.

### Forge tiers

**Stone Forge**
- refine Iron Ore + Coal → Iron Ingot

**Iron Forge**
- upgrade cost: 6 Iron Ingots + 4 Cobblestone
- adds iron equipment crafting
- adds gold refining

**Master Forge**
- upgrade cost: 4 Gold Ingots + 4 Iron Ingots + 2 Diamond Ore
- adds diamond refining
- unlocks Diamond Pickaxe
- unlocks Forgebrand masterwork

Forgebrand recipe:

- 2 Refined Diamond
- 2 Gold Ingots
- 2 Iron Ingots
- 1 Stick

Per-station tier, processing job/progress, and buffered output are saved. Breaking a forge loses the station's tier investment but salvages committed refining input/fuel and completed buffered output so destruction cannot silently delete those resources.

---

## Combat and enemy identity

The current roster is Forge-original while retaining three easy-to-read pressure roles:

### Ashbound

Charred melee pursuer with ember fractures. Close-range pressure. May drop Coal Ore.

### Shardcaster

Faceted mineral ranged enemy. Maintains distance and fires spinning crystal shards. May drop Cobblestone.

### Slagburst

Low volcanic/slag creature. Closes distance, fuses, and explodes, damaging nearby terrain. May drop Coal Ore if killed before detonation; self-detonation does not create loot.

Enemy loot deliberately feeds existing survival/forge loops instead of creating a separate collectible economy.

The inventory `PlayerPreview` uses a Forge-specific frontier-smith presentation rather than the earlier Steve-like styling.

---

## Night pressure and defensive preparation

Night difficulty is controlled by `NightPressureSystem` and caps rather than scaling forever:

### Night 1 — Baseline
- max 5 hostiles
- ~7s spawn cadence
- Ashbound + limited Shardcasters
- no Slagburst pressure

### Night 2 — Rising
- max 9 hostiles
- ~4.8s cadence
- tighter spawn distance
- small Slagburst chance

### Night 3+ — Peak
- max 13 hostiles
- ~3.4s cadence
- highest mixed pressure
- profile caps here even as the displayed night number continues increasing

The HUD warns shortly before sunset.

Placed **Torches and Glowstone** suppress hostile spawn candidates within an 8-block radius. The player flashlight is visual-only and does not count as defensive preparation.

Night number and active-night state persist, so save/load cannot reset or double-count escalation.

---

## Finale / win state

The 0.3 slice has an explicit finish state managed by `FinaleSystem` / `FinaleController`.

Late-game path:

1. reach Iron Forge → masterwork objective appears
2. upgrade to Master Forge
3. craft Forgebrand
4. reach Peak pressure (Night 3+)
5. survive **60 seconds** during the final stand
6. land at least **one Forgebrand killing blow**

Both survival time and the Forgebrand kill are required.

An unfinished attempt resets if:

- the player dies
- Peak Night ends before completion
- Master Forge eligibility is lost
- Forgebrand is no longer held

Success persists permanently and displays `THE FORGE HOLDS`. The player can choose **Continue this world** afterward. Reloading a completed save preserves the achievement but does not repeatedly block play with the completion modal.

---

## Input

### Desktop

- WASD / arrows: movement
- mouse: look
- Space: jump
- Shift: sprint
- Left Ctrl: sneak
- left mouse: attack / hold to mine
- X: alternate break input
- right mouse: place / interact
- E: inventory
- F: flashlight
- 1–9 or wheel: hotbar selection
- F3: debug overlay

Desktop uses Pointer Lock.

### Touch

Coarse-pointer devices use separate movement/look touch zones plus on-screen Jump, Break, Place, Inventory, and Flashlight buttons. The virtual movement stick enables sprint near its outer range. Touch cancel/visibility/blur paths clear held controls to avoid stuck input.

---

## Save model

`SaveManager`:

- key: `forge_3d_v1`
- current version: `2`
- supports versions 1 and 2
- validates core player/inventory/time/world shape before accepting a save

Current composed state includes, as applicable:

- player transform/stats
- inventory/hotbar
- world sparse edits
- time/day phase
- first-session progression
- forge stations/jobs/output
- night-pressure progression
- finale progression/completion

Normal play autosaves about every 30 seconds. Important progression transitions save immediately. Save errors are surfaced in game state rather than treated as silent success.

Persistence is browser-local only; there is no cloud/account save layer.

---

## Tests and regression expectations

Run:

```bash
npm test
npm run build
```

Current tests cover more than unit-level helpers. They protect important game invariants including:

- input interruption and one-shot controls
- first-session sequence and safe spawn resources
- inventory stack/resource conservation
- atomic crafting
- sparse world persistence/migration
- ore generation/order and progression headroom
- mining tool/depth gates
- forge tiers/refining/save/destruction behavior
- night escalation and lighting defense
- Forge-original enemy identity/drop contracts
- finale requirements, resets, save/load, and completion persistence

When changing one of those systems, extend the regression contract rather than deleting an assertion simply to make CI green.

---

## Current limitations / next work

### #29 — vertical-slice playtest and tuning

The assembled loop still needs the intended full fresh-save acceptance pass. Validate:

- no progression deadlocks
- first objective clarity
- gathering/refining grind
- Night 1 fairness and later-night pressure
- actual 20–30 minute completion time
- death/respawn and save/load across the full loop
- touch/mobile usability
- performance under later-night combat and chunk streaming

Do not expand the sandbox until material failures found there are addressed.

### #44 — item sprite polish

Iron Ingot, Gold Ingot, and Refined Diamond still use generic inventory fallback visuals. Forgebrand also currently inherits the legacy top-tier sword sprite because item ID 103 is preserved for save compatibility. Give these items distinct Forge-readable sprites without changing their numeric IDs.

### Other intentional omissions

- no armor gameplay system yet
- no audio system
- no multiplayer
- no farming/NPC village loop
- no enchanting/large tech tree
- no procedural dungeon campaign
- no cloud saves

These are omissions, not promises for the next release.

---

## Deployment

`.github/workflows/deploy.yml` runs:

```text
checkout
setup Node 20
npm ci
npm test
npm run build
```

Pull requests validate but do not deploy. Successful `main` runs upload `dist/` and deploy through GitHub Pages.

Do not weaken PR validation to make deployment faster; the current suite is small enough to keep test + build as the merge gate.

---

## Historical documentation

`HANDOFF_SOURCE_1.md` and `HANDOFF_SOURCE_2.md` came from older prototypes and are not current implementation guidance. Their active-tree versions are reduced to historical stubs; use Git history only if the old prototype context is specifically needed.

The current sources of truth are:

1. the code on `main`
2. this `HANDOFF.md`
3. `README.md`
4. roadmap issue #20 and its child issues
