// Light-plane view contracts — the seam the @hoard-engine/scene light
// compositing consumes (radial glows, aura rings, gas clouds, sparkles,
// baked sprites, the ambient darkness veil): it draws only plain
// per-frame light views. The consumer resolves every engine computation —
// the animated center (alignment, ceiling, sway, sweep), the occlusion
// polygon, the per-frame brightness, the blur — so this package imports
// neither the consumer's state nor any lighting engine
// (docs/engine-packages.md, dependency rule 1: scene declares its
// light-map input type).

import type { ScenePoint } from './contracts';

// One sparkle twinkle: a bright cross with a soft disc behind it. The
// adapter computes the positions; the renderer only paints them.
export type SceneSparkle = {
  x: number;
  y: number;
  arm: number;
  alpha: number;
};

// One light resolved for the current frame.
export type SceneLightView = {
  // The light's center in world pixels, with alignment, ceiling and
  // sway/sweep offsets applied.
  center: ScenePoint;
  // The light's colour and peak brightness, with descriptor defaults
  // already applied by the adapter.
  color: string;
  intensity: number;
  // The light's radius in world pixels (descriptor radius × cell size).
  radius: number;
  // Per-frame animation brightness multiplier (1 for static lights):
  // pulse, flicker and blink dim and brighten here.
  intensityScale: number;
  // The blur in pixels the shape is filled with (softness), resolved by
  // the adapter; the renderer's blur toggle still gates it at draw time.
  blurPx: number;
  // Open effect name ('static' | 'pulse' | 'flicker' | 'blink' | 'sway' |
  // 'sweep' | 'sparkle' | 'aura' | 'gas'); unknown names render as the
  // plain glow.
  effect: string;
  // The lit-area polygon in world pixels, resolved against the world's
  // occlusion — empty for the aura and sparkle effects, which draw
  // inside their own cell.
  polygon: ScenePoint[];
  // Twinkle positions while the effect is 'sparkle', else empty.
  sparkles: SceneSparkle[];
  // Whether the glow's geometry never changes between frames — the
  // light can be baked into a cached sprite and blitted alpha-scaled.
  bakeable: boolean;
  // Opaque sprite-cache tokens: the identity of the light descriptor and
  // the occlusion key of the world state it was resolved against. An
  // unchanged pair means the cached sprite is reusable pixel-for-pixel.
  spriteIdentity: string;
  occlusionKey: string;
};

// The visible part of the world, in grid cells: the rectangle starting at
// (x, y) spanning width x height cells — structurally compatible with
// any consumer's cell-rectangle type (the lighting engine's viewport,
// included). Optional everywhere the renderer uses it: without it, every
// cell is visible.
export type SceneViewport = {
  x: number;
  y: number;
  width: number;
  height: number;
};
