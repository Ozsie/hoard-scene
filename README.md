# @hoard-engine/scene

The world canvas renderer for the HOARD engine: view-typed compositing
for tile worlds on canvas. Two projections are included: the top-down
plane — the dungeon layer (grid, walls, doors, secrets, terrain, fog,
pillars, portal), the light layer (gradients, aura/gas/sparkle effects,
baked light sprites, the ambient darkness veil), the actor/item/overlay
layer (sprite frames, fallback tiles, bars, pips) and floating text, all
with tileset handling, texture caching and corner-cap paint rules — and
the 2.5D isometric plane (`createIsoProjection` + `SceneIsoView`), which
draws diamond floors, extruded wall prisms and painter-sorted upright
actors, plus an additive light pass over consumer-resolved lit-area
polygons. A leaf of the [HOARD
engine](https://github.com/Ozsie/drakriddarna/blob/main/docs/engine-packages.md)
— the renderer never gains game knowledge: everything it draws arrives
as plain view models.

## Pluggable, interoperable, standalone

HOARD engine packages share the same design goals:

- **Pluggable.** Adopt a package on its own, or swap it out, without
  touching the rest of the engine — there is no central engine object
  to install and no package that owns the others.
- **Interoperable.** Packages compose with each other and with consumer
  code through data: minimal shapes, callback seams and plain values —
  never through shared state or a common framework.
- **As standalone as possible.** Each package is usable as-is in any
  project, HOARD-based or not; the leaf packages carry no dependencies
  and import no siblings.

This package meets all three by construction: it imports nothing, and
its only inputs are the view-model contracts.

## Install

```bash
npm install @hoard-engine/scene
```

Requires Node 18+ (ESM only).

## Usage

Build plain view models (your game's job) and hand them to the
compositing cores:

```ts
import {
  SceneDungeonView,
  SceneLightView,
  SceneActorView,
  renderGrid,
  renderLights,
  renderActorView,
} from '@hoard-engine/scene';

// Your dungeon data is structurally compatible with SceneDungeonView;
// corner data, the fog-of-war-sealed grid and resolved terrain styling
// arrive as view fields — the package runs no detection of its own.
const view: SceneDungeonView = {
  name: 'The Ice Dragon\'s Treasure',
  discoveredRooms: ['A', 'B'],
  layout: {
    grid: ['#####', '#AB.#', '#####'],
    doors: [{ x: 2, y: 1, side: 'Down', open: false }],
    secrets: [],
    corners: [{ position: { x: 1, y: 2 }, type: 'OTL' }],
    sealedGrid: ['#####', '#AB #', '#####'],
  },
};

renderGrid(ctx, floorSheet, cellSize, view, false);

// Lights arrive fully resolved — polygons, centers, per-frame
// brightness computed against your own occlusion world (with
// @hoard-engine/lighting or any source of your choice).
renderLights(ctx, cellSize, lightViews, false);
```

## View models

- `SceneDungeonView` — the static world plane: grid rows, doors, edge
  walls, secrets, terrain, room fog, pillars, pits, interactables, the
  portal, plus the consumer-resolved corner classification and sealed
  grid.
- `SceneLightView` — one resolved light: center, colour, intensity,
  radius, polygon, sparkles, bake tokens.
- `SceneIsoWorldView` / `SceneIsoActorView` / `SceneIsoLightView` — the
  isometric plane: string grid rows over the consumer's wall/door
  tokens, palette and wall extrusion height; upright actors at their
  feet positions; and lights whose lit-area polygons the consumer has
  already resolved against its own occlusion world
  (`drawIsoWorldFrame`, `drawIsoLights`).
- `SceneActorView` / `SceneItemView` / `SceneHeroOverlayView` /
  `SceneFloatingText` — the animated planes.

The package also exports the light-compositing controls
(`setLightBlurDisabled`, `clearLightSpriteCache`), the tile texture
cache and sprite-sheet math.

Browser-bound by nature (canvas); everything tolerates a headless
environment by falling back to direct drawing when offscreen canvases
are unavailable.
