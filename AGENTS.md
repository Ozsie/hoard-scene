# AGENTS.md

`@hoard-engine/scene` — a HOARD engine package (spec:
`docs/engine-packages.md` in the originating game repo). The world canvas
renderer: view-typed compositing for the dungeon plane (grid, walls,
doors, secrets, terrain, fog, pillars, portal), the light plane
(gradients, effect shapes, baked sprites, the ambient darkness veil),
the actor/item/overlay plane (sprite frames, fallback tiles, bars,
pips) and floating text — all driven by plain view models. The
top-down cores were extracted from the drakriddarna repo's `src/scene/`
and `src/dungeon/` (the world-rendering half) at step 9 of the
extraction order; the isometric cores (projection, screen mapping,
painter compositing, the additive light pass) arrived from the
metroidvania repo's `src/game/scene/` at 0.2.0. The games keep the
adapters (GameState → view models) and all assets.

## What this package is

- The view-model renderer for a tile world on canvas: every drawing
  core consumes only the plain shapes declared in `contracts.ts`,
  `dungeonView.ts`, `lightsView.ts` and the iso modules
  (`isoProjection.ts`, `isoView.ts`, `isoCanvas.ts`). No GameState,
  Actor, Monster or any game type crosses the seam; named tile
  references, resolved texts and classified data arrive as view data.
  The iso light views arrive fully resolved (polygon, center, radius,
  brightness), so the iso light pass never touches a lighting engine.
- Tileset handling with texture caching (the built-in tileset's slot
  layout, corner caps, the off-screen tile canvas), corner-cap and
  wall-run paint rules, fog-cloud cloud caching.
- Like every HOARD engine package, it is designed to be pluggable and
  interoperable, and as standalone as possible: individually adoptable,
  swappable and usable without any other HOARD package, game or
  framework. Packages compose through data — minimal shapes, callbacks,
  plain values — never through shared state; a new dependency or a
  sibling import here is a design regression, not an optimization.
- Browser-bound by nature (canvas types, offscreen canvases); its tests
  run in plain Node over canvas mocks and guard whether offscreen
  canvases exist before using them.

## Hard boundaries

- Package sources import nothing but relative files — no game code, no
  Svelte, no i18n, no node builtins, no engine siblings (including
  `@hoard-engine/lighting`: the light views arrive resolved, so
  compositing declares its light-map input type). Enforced by lint and
  `src/boundary.test.ts`; tests may additionally import `vitest`.
- The cell vocabulary (`WALL`, `EMPTY`, `COLLAPSED`, `SEALED_DOOR`, the
  `CornerType` and `LightEffect` member values) is re-declared locally
  with the reference values — consumers' data passes by structural
  compatibility, never through a shared import. Changing a value is a
  breaking vocabulary change; ask before "fixing" either side.
- Corner data, the fog-of-war-sealed grid and resolved terrain styling
  arrive in the view (`layout.corners`, `layout.sealedGrid`,
  cell fields); the package runs no classification and no detection —
  consumers resolve their visible state, with the corner-classification
  engine of their choice.
- The public surface is exactly `src/index.ts` — every export is
  re-exported there (`src/publicSurface.test.ts` fails otherwise).
  Consuming anything through another path is a bug.
- Rendering changes are rule-visible. The originating game repo pins
  its renderers with facade tests over the historical entry points; a
  change that alters drawn output is a visual change the consumer must
  accept — RULES.md and the game own the decisions.
- The planned dependency edge into `@hoard-engine/primitives` (the
  two-consumer rule: uikit and scene both draw) activates only once the
  compositing actually consumes the text/geometry helpers; a
  dependency-free leaf until then.

## Commands

```bash
npm test          # vitest (boundary, public-surface, sprite math)
npm run check     # tsc --noEmit (strict)
npm run lint      # eslint over src and vitest.config.ts
npm run prettier  # prettier --check (fix via prettier:format)
npm run build     # tsc declarations + esbuild ESM bundle to dist/
```

Run `npm run check`, `npm test`, and `npm run lint` before considering
work done.

## Conventions

- Prettier with single quotes, 2-space indent, print width 80;
  TypeScript is in strict mode — no `any`, no `console`.
- Tests are colocated as `*.test.ts` next to the module they cover.
- The unit tests here cover the package's pure computation
  (sprite-sheet rect math, iso projection and screen mapping,
  surface/boundary invariants); the compositing cores are exercised
  through the originating game's facade tests,
  which drive them through the view models and pin the visual rules
  (wall runs, doors, terrain overlays, fog, light effects).
- `dist/` is build output — never edit it, never commit it.
- Publishing: `prepublishOnly` runs check + build + test; the version is
  bumped first, before `npm publish`. No license field is added
  unilaterally — that is the repo owner's decision.
- Anatomy of an addition: a new compositing core goes into `src/`, takes
  view models only, and is re-exported from `src/index.ts` in the same
  change. New view-model fields land in the view contracts first, with
  the originating game's adapter resolving them before the lift.
