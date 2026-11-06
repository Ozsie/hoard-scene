# TODO: React Native support (thin Skia bridge, audio excluded)

Not committed to — this is the sketch of what it would take if a React
Native target becomes interesting. Reference: the canvas-facing packages
(`primitives`, `uikit`, `scene`) are dependency-injected; every consumer
already passes its own `CanvasRenderingContext2D`, and `scene`'s three
offscreen-cache builders already feature-detect `document` with graceful
direct-draw fallbacks.

## What a bridge would have to cover

- ~22 straightforward ctx members: paths (`beginPath`, `moveTo`, `lineTo`,
  `arc`, `arcTo`, `rect`, `roundRect`, `closePath`, `clip`), `fill`,
  `stroke`, `fillRect`, `strokeRect`, `fillText`, `strokeText`,
  `measureText`, `fillStyle`, `strokeStyle`, `lineWidth`, `lineJoin`,
  `font`, `textAlign`, `textBaseline`, `globalAlpha`, `save`, `restore`,
  `setTransform`.
- Three sharp edges:
  - `createRadialGradient` (5 uses);
  - `globalCompositeOperation` limited to `source-over`, `source-atop`,
    `destination-out` — a small blend map;
  - `ctx.filter = 'blur(npx)'` (5 uses) — degrades to hard edges where the
    target ignores it (already the documented behavior for browsers
    without filter support).
- Offscreen surfaces: `drawImage` receives other canvases (fog clouds in
  `dungeonCanvas.ts`, light sprites and the darkness veil in
  `lightsCanvas.ts`, baked tiles in `tileTextureCache.ts`), so a bridge
  needs an offscreen-canvas factory, not just one wrapped context.
- No `HTMLImageElement` dependency for rendering: `tileTextureCache.ts`
  only sniffs it for cache keys, with a structural fallback.
- Audio (`@hoard-engine/audio`) is out of scope: `MusicManager` and
  `SoundEffectManager` construct `HTMLAudioElement` and attach `window`
  listeners directly. A native target would need an adapter over
  `expo-av` / `react-native-sound` implementing the same interface.

## Plan (thinnest path)

1. Structural context interface. `primitives` (which `uikit` and `scene`
   sit on) exports a minimal `HoardContext` interface listing only the
   members actually used, and the `ctx: CanvasRenderingContext2D` params
   across `primitives`, `uikit`, `scene` are narrowed to it. A real DOM
   ctx still satisfies it structurally — types-only diff, no behavior
   change. Without this, any Skia adapter fails to typecheck or must
   fake the entire ~100-member DOM interface.
2. Injectable offscreen factory in `scene`. `canBuildOffscreenCanvas()`
   and the two other `document`-detected builders gain a settable
   module-level offscreen-canvas factory. On RN today the no-cache
   fallback is graceful but re-draws fog clouds and light sprites every
   frame with no blur; a factory would restore the fast paths. Careful:
   keep the existing browser default and the detection guards intact so
   nothing changes for current consumers.
3. New package `@hoard-engine/rn-canvas` with
   `@shopify/react-native-skia` as a peer dependency: implements
   `HoardContext` over Skia, provides the offscreen factory, and exports
   a thin `<HoardCanvas>` React component wiring the adapter to Skia's
   canvas plus a frame loop. Engine packages stay sibling-import-free;
   the bridge package does all the platform coupling.

Hard parts all land in the bridge, not the engine: mapping `ctx.font`
CSS shorthand strings to `matchFont`, `textBaseline` orthogonality (Skia
measures from the top), blur filter to `ImageFilter.Blur`, and keeping a
mutable state machine (`fillStyle`, `globalAlpha`, transforms) on top of
Skia's immutable paints. Rough estimate: 500–800 lines.

## Open questions

- Verify Skia's `roundRect`, `arcTo` and gradient falloff match the
  canvas semantics scene relies on (one visual pass with the game's
  facade tests as reference output).
- Is the no-cache fallback path's per-frame fog/light re-render
  acceptable on low-end RN devices without step 2?
- uikit input handling: widgets receive pointer state through props, but
  the RN touch model differs — decide whether `rn-canvas` also adapts
  touches or leaves that to the consumer.
- react-native-web would make all of this unnecessary (`document` and
  canvas exist); whether a native/Skia path is worth it at all.

## Leverage for existing consumers

None of the steps above may change drawn output for browser consumers —
`scene`'s facade tests in the game repo pin the visual rules; any change
that alters output needs the game repo's sign-off.
