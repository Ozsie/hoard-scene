// The light compositing: gradients, effect shapes, baked sprites and
// the ambient darkness veil — the view-typed half of the renderer that
// consumes only SceneLightView data (src/lightsView.ts). Every engine
// computation (occlusion polygons, animated centers, per-frame
// brightness, sparkles) is resolved by the consumer before the light
// reaches this module; no game state, no lighting-engine imports.
import { LightEffect } from './cellVocabulary';
import type { ScenePoint } from './contracts';
import type { SceneLightView } from './lightsView';

const rgbaFromColor = (color: string, alpha: number): string => {
  const hex = color.replace('#', '');
  const expand = (part: string): number =>
    parseInt(part.length === 1 ? part + part : part, 16);
  if (hex.length === 3) {
    const r = expand(hex[0]);
    const g = expand(hex[1]);
    const b = expand(hex[2]);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  // Named colors and other formats: let them render as-is with the alpha
  // handled through the gradient stop opacity.
  return color;
};

// Ambient (dungeon-wide) light level used when a dungeon does not specify
// one: 1 = fully lit, 0 = pitch black.
// Fills a light shape (a polygon glow, an aura ring, a hole punched into
// darkness) with soft edges when the light asks for them. `ctx.filter`
// blurs the filled shape; on browsers without canvas filter support the
// assignment is ignored and edges stay hard.
//
// While a pan drag is active the controller disables the blur (see
// `setLightBlurDisabled`): the direct per-frame draws drop their filter
// as a fill-cost cut, trading soft light rims for drag smoothness. Sprite
// bakes always blur — the sprite cache key does not encode this flag, so
// a bake must always produce full-quality pixels.
let lightBlurDisabled = false;

export const setLightBlurDisabled = (disabled: boolean): void => {
  lightBlurDisabled = disabled;
};

const fillLightShape = (
  ctx: CanvasRenderingContext2D,
  trace: (ctx: CanvasRenderingContext2D) => void,
  fillStyle: CanvasGradient,
  blurPx: number,
) => {
  const blur = lightBlurDisabled ? 0 : blurPx;
  if (blur > 0) {
    ctx.filter = `blur(${blur}px)`;
  }
  ctx.save();
  trace(ctx);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();
  ctx.filter = 'none';
};

const traceLightPolygonPath = (
  ctx: CanvasRenderingContext2D,
  points: ScenePoint[],
) => {
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.closePath();
};

const fillLightPolygon = (
  ctx: CanvasRenderingContext2D,
  points: ScenePoint[],
  fillStyle: CanvasGradient,
  blurPx: number,
) =>
  fillLightShape(
    ctx,
    (c) => traceLightPolygonPath(c, points),
    fillStyle,
    blurPx,
  );

// --- Sparkle effect ------------------------------------------------------

// Draws a sparkle light: small colored glints (a cross with a bright core)
// twinkling inside the light's cell, each with a soft disc behind it. No
// radial glow. The glints and discs go into the light mask, so they also
// shape the hole the sparkles punch into the ambient darkness.
// The twinkle positions (computeSparkles) live in the engine package.
const renderSparkles = (
  ctx: CanvasRenderingContext2D,
  view: SceneLightView,
  cellSize: number,
) => {
  const intensity = view.intensity;
  const sparkles = view.sparkles;
  ctx.save();
  ctx.strokeStyle = view.color;
  ctx.lineWidth = Math.max(1, cellSize / 32);
  ctx.fillStyle = '#FFFFFF';
  sparkles.forEach((sparkle) => {
    // The disc keeps a small hole in the darkness around the twinkle.
    ctx.globalAlpha = Math.min(1, sparkle.alpha * 0.85);
    ctx.beginPath();
    ctx.arc(
      sparkle.x,
      sparkle.y,
      Math.max(2, sparkle.arm * 1.5),
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.globalAlpha = Math.min(1, sparkle.alpha * intensity * 2.2);
    ctx.beginPath();
    ctx.moveTo(sparkle.x - sparkle.arm, sparkle.y);
    ctx.lineTo(sparkle.x + sparkle.arm, sparkle.y);
    ctx.moveTo(sparkle.x, sparkle.y - sparkle.arm);
    ctx.lineTo(sparkle.x, sparkle.y + sparkle.arm);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sparkle.x, sparkle.y, sparkle.arm * 0.35, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
};

// --- Aura effect ---------------------------------------------------------

// How much of the ring's peak brightness the aura's center glows with.
const AURA_CENTER_GLOW = 0.35;

// Ring brightness of an aura at fraction `t` of its radius: a soft,
// even glow across the center of the cell, rising steeply into a defined
// bright ring peaking at ~70% of the radius and fading out at the cell
// edge.
const auraRingAlpha = (t: number, peak: number): number => {
  if (t <= 0.35) {
    // Soft center halo.
    return peak * AURA_CENTER_GLOW;
  }
  if (t <= 0.7) {
    // Steep rise from the center glow into the bright ring.
    const k = (t - 0.35) / 0.35;
    return (
      peak * (AURA_CENTER_GLOW + (1 - AURA_CENTER_GLOW) * (k * k * (3 - 2 * k)))
    );
  }
  // Falls to exactly zero at the cell edge.
  return peak * Math.pow(Math.max(0, (1 - t) / 0.3), 2);
};

// The aura's donut-shaped gradient: an inscribed circle in the light's own
// cell, with a soft center glow and a bright ring around it.
const createAuraGradient = (
  ctx: CanvasRenderingContext2D,
  view: SceneLightView,
  cellSize: number,
  scaleOverride?: number,
) => {
  const center = view.center;
  const radiusPx = cellSize / 2;
  const color = view.color;
  // Slightly brighter than a plain glow so the ring reads as a halo.
  const peak = Math.min(
    1,
    view.intensity * 1.8 * (scaleOverride ?? view.intensityScale),
  );
  const gradient = ctx.createRadialGradient(
    center.x,
    center.y,
    0,
    center.x,
    center.y,
    radiusPx,
  );
  const stops = [0, 0.1, 0.2, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
  stops.forEach((t) => {
    gradient.addColorStop(t, rgbaFromColor(color, auraRingAlpha(t, peak)));
  });
  return gradient;
};

// The farthest polygon point from the light, so a room-filling gas
// gradient covers the whole cloud.
const polygonExtentPx = (center: ScenePoint, points: ScenePoint[]): number =>
  points.reduce(
    (max, point) =>
      Math.max(max, Math.hypot(point.x - center.x, point.y - center.y)),
    0,
  );

// --- Gas effect ----------------------------------------------------------

// The gas effect's gradient: an even, cloud-like intensity across the lit
// area — no bright center — fading only at the rim. Combined with the
// undulating intensity from `lightIntensityScale` this reads as a slowly
// swirling cloud. The light's polygon still applies, so walls contain the
// gas; its extent defaults to the light's radius, or `gradientRadiusPx`
// when the polygon is larger (gas fills its whole room).
const createGasGradient = (
  ctx: CanvasRenderingContext2D,
  view: SceneLightView,
  gradientRadiusPx?: number,
  scaleOverride?: number,
) => {
  const center = view.center;
  const color = view.color;
  const intensity = view.intensity;
  const radiusPx = gradientRadiusPx ?? view.radius;
  const gradient = ctx.createRadialGradient(
    center.x,
    center.y,
    0,
    center.x,
    center.y,
    radiusPx,
  );
  const alpha = Math.min(
    1,
    intensity * 1.4 * (scaleOverride ?? view.intensityScale),
  );
  const stops = [0, 0.15, 0.3, 0.45, 0.55, 0.7, 0.85, 1];
  stops.forEach((t) => {
    // Flat through the middle of the cloud, soft fall at the rim (falling
    // to exactly zero at the edge).
    const rim = t <= 0.55 ? 1 : Math.pow(Math.max(0, (1 - t) / 0.45), 1.5);
    gradient.addColorStop(t, rgbaFromColor(color, alpha * rim));
  });
  return gradient;
};

const traceAuraCircle =
  (view: SceneLightView, cellSize: number) =>
  (ctx: CanvasRenderingContext2D) => {
    const center = view.center;
    ctx.beginPath();
    ctx.arc(center.x, center.y, cellSize / 2, 0, Math.PI * 2);
  };

// Draws an aura light: a breathing donut ring filling its own cell, with
// the center of the cell left unaffected. No polygon glow, no spill into
// neighbouring cells.
const renderAura = (
  ctx: CanvasRenderingContext2D,
  view: SceneLightView,
  cellSize: number,
) => {
  fillLightShape(
    ctx,
    traceAuraCircle(view, cellSize),
    createAuraGradient(ctx, view, cellSize),
    view.blurPx,
  );
};

// Builds the light's radial gradient. One continuous falloff, bright at the
// source and fading out at the radius. Canvas interpolates linearly between
// stops, so the curve is sampled densely — a coarse stop set (or a separate
// small "core" gradient) leaves slope changes that show up as distinct rings
// around the center.
const createLightGradient = (
  ctx: CanvasRenderingContext2D,
  view: SceneLightView,
  scaleOverride?: number,
) => {
  const center = view.center;
  const color = view.color;
  const intensity = view.intensity;
  const radiusPx = view.radius;
  const gradient = ctx.createRadialGradient(
    center.x,
    center.y,
    0,
    center.x,
    center.y,
    radiusPx,
  );
  const peakIntensity = Math.min(
    1,
    intensity * 1.5 * (scaleOverride ?? view.intensityScale),
  );
  const falloffStops = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
  falloffStops.forEach((t) => {
    const alpha = peakIntensity * Math.pow(1 - t, 2);
    gradient.addColorStop(t, rgbaFromColor(color, alpha));
  });
  return gradient;
};

// Renders the light's full-brightness output directly onto `ctx` — the
// pre-sprite path, still used for effects whose geometry or per-part
// brightness changes every frame, and where offscreen canvases are
// unavailable (the node test environment).
const renderLightDirect = (
  ctx: CanvasRenderingContext2D,
  view: SceneLightView,
  cellSize: number,
): void => {
  switch (view.effect) {
    case LightEffect.SPARKLE:
      renderSparkles(ctx, view, cellSize);
      break;
    case LightEffect.AURA:
      renderAura(ctx, view, cellSize);
      break;
    case LightEffect.GAS: {
      const points = view.polygon;
      fillLightPolygon(
        ctx,
        points,
        createGasGradient(ctx, view, polygonExtentPx(view.center, points)),
        view.blurPx,
      );
      break;
    }
    default:
      fillLightPolygon(
        ctx,
        view.polygon,
        createLightGradient(ctx, view),
        view.blurPx,
      );
      break;
  }
};

// --- Light sprites ----------------------------------------------------------
//
// Lights whose glow geometry never changes between frames can have their
// full-brightness output baked once into a sprite and then only blitted,
// alpha-scaled by the current animation brightness. Which lights are
// bakeable — and the sprite-identity token the cache is keyed on — are
// resolved by the consumer into `view.bakeable` / `view.spriteIdentity`.
// Static lights never alpha-scale (their intensity scale is a constant
// 1), so their sprite is pixel-exact at any intensity — baking them
// keeps the softness blur out of every static-layer rebuild, pan moves
// included.
type LightSprite = {
  key: string;
  canvas: HTMLCanvasElement;
  // World-pixel offset of the sprite's top-left corner.
  x: number;
  y: number;
  // World-pixel size of the sprite (the canvas is deviceRatio times this).
  size: number;
};

// One entry per distinct light (identity without the occlusion state);
// the entry's key carries the full invalidation state and is replaced
// whenever it changes.
// Upper bound on baked light sprites, mirroring
// MAX_LIGHT_POLYGON_CACHE_ENTRIES. Each light identity (position,
// alignment, colour, radius, intensity, softness, effect) holds one
// offscreen canvas; without a bound a long session of moving carried
// lights, projectiles and event lights — every one a fresh identity —
// would grow the cache without limit. Eviction only happens when a new
// identity is added: existing entries stay reusable while their
// occlusion key is unchanged, and clearLightSpriteCache still empties
// the whole map.
export const MAX_LIGHT_SPRITE_CACHE_ENTRIES = 64;

const lightSpriteCaches = new Map<string, LightSprite>();

export const clearLightSpriteCache = (): void => {
  lightSpriteCaches.clear();
};

const canBuildLightSprite = (): boolean =>
  typeof document !== 'undefined' &&
  typeof document.createElement === 'function';

// Bakes the light's full-brightness glow into an offscreen canvas: the
// visibility polygon (or aura ring or gas cloud) filled with its radial
// gradient under the softness blur, exactly as the direct path renders,
// but at animation scale 1 and only once per occlusion state. The view's
// polygon and center are frame-invariant for bakeable lights (sway,
// sweep and sparkle are not bakeable), so the view data is exactly the
// bake input.
const buildLightSprite = (
  view: SceneLightView,
  cellSize: number,
  key: string,
): LightSprite | null => {
  if (!canBuildLightSprite()) return null;
  const blurPx = view.blurPx;
  let draw: (c: CanvasRenderingContext2D) => void;
  let extent: number;
  if (view.effect === LightEffect.AURA) {
    extent = cellSize / 2 + blurPx + 2;
    draw = (c) =>
      fillLightShape(
        c,
        traceAuraCircle(view, cellSize),
        createAuraGradient(c, view, cellSize, 1),
        blurPx,
      );
  } else {
    const points = view.polygon;
    extent = polygonExtentPx(view.center, points) + blurPx + 2;
    draw =
      view.effect === LightEffect.GAS
        ? (c) =>
            fillLightPolygon(
              c,
              points,
              createGasGradient(
                c,
                view,
                polygonExtentPx(view.center, points),
                1,
              ),
              blurPx,
            )
        : (c) =>
            fillLightPolygon(
              c,
              points,
              createLightGradient(c, view, 1),
              blurPx,
            );
  }

  const size = Math.ceil(extent * 2);
  if (size <= 0) return null;
  const ratio = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(size * ratio);
  canvas.height = Math.ceil(size * ratio);
  const spriteCtx = canvas.getContext('2d');
  if (!spriteCtx) return null;
  spriteCtx.scale(ratio, ratio);
  spriteCtx.translate(extent - view.center.x, extent - view.center.y);
  // Bakes always run at full quality, even mid-drag: the sprite cache
  // key does not encode the blur flag, so an unblurred bake would poison
  // the cache for the post-drag full-quality frames.
  const blurWasDisabled = lightBlurDisabled;
  lightBlurDisabled = false;
  try {
    draw(spriteCtx);
  } finally {
    lightBlurDisabled = blurWasDisabled;
  }
  return {
    key,
    canvas,
    x: view.center.x - extent,
    y: view.center.y - extent,
    size,
  };
};

const lightSpriteFor = (
  view: SceneLightView,
  cellSize: number,
): LightSprite | null => {
  if (!canBuildLightSprite()) return null;
  const key = `${view.occlusionKey}|${view.spriteIdentity}`;
  const cached = lightSpriteCaches.get(view.spriteIdentity);
  if (cached && cached.key === key) return cached;
  const sprite = buildLightSprite(view, cellSize, key);
  if (sprite) {
    if (
      !lightSpriteCaches.has(view.spriteIdentity) &&
      lightSpriteCaches.size >= MAX_LIGHT_SPRITE_CACHE_ENTRIES
    ) {
      // Evict the oldest entry: Map keys iterate in insertion order.
      for (const oldest of lightSpriteCaches.keys()) {
        lightSpriteCaches.delete(oldest);
        break;
      }
    }
    lightSpriteCaches.set(view.spriteIdentity, sprite);
  }
  return sprite;
};

const renderLight = (
  ctx: CanvasRenderingContext2D,
  cellSize: number,
  view: SceneLightView,
  debugMode: boolean,
) => {
  if (view.bakeable) {
    const sprite = lightSpriteFor(view, cellSize);
    if (sprite) {
      ctx.save();
      ctx.globalAlpha = view.intensityScale;
      ctx.drawImage(
        sprite.canvas,
        sprite.x,
        sprite.y,
        sprite.size,
        sprite.size,
      );
      ctx.restore();
      if (debugMode) {
        drawLightDebugCircle(ctx, view.center, cellSize);
      }
      return;
    }
  }

  renderLightDirect(ctx, view, cellSize);

  if (debugMode) {
    drawLightDebugCircle(ctx, view.center, cellSize);
  }
};

const drawLightDebugCircle = (
  ctx: CanvasRenderingContext2D,
  center: ScenePoint,
  cellSize: number,
) => {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(center.x, center.y, cellSize * 0.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

// Draws the given light views, resolved by the consumer
// (renderability and viewport culling are applied by the builder).
export const renderSceneLights = (
  ctx: CanvasRenderingContext2D,
  cellSize: number,
  views: SceneLightView[],
  debugMode: boolean,
): void => {
  views.forEach((view) => {
    renderLight(ctx, cellSize, view, debugMode);
  });
};

// The ambient darkness veil: the whole canvas dark with alpha
// (1 - ambient), with the light mask punched out so lit areas stay
// visible. `lightMaskCanvas` holds the pixels `renderSceneLights` just
// drew (same pixel size and world transform as the veil canvas):
// re-using those pixels keeps the visible glow and the darkness hole in
// perfect lockstep. `destination-out` removes darkness where the mask
// is opaque. Composited on top of actors, so actors standing in the dark
// are dimmed as well. The ambient level arrives resolved by the
// consumer, so the drawing sees no game state.
export const renderSceneAmbientDarkness = (
  ctx: CanvasRenderingContext2D,
  darknessCanvas: HTMLCanvasElement,
  lightMaskCanvas: HTMLCanvasElement,
  ambient: number,
): void => {
  if (ambient >= 1) return;
  const darknessCtx = darknessCanvas.getContext('2d');
  if (!darknessCtx) return;

  // Fill the whole canvas with darkness, in device space.
  darknessCtx.save();
  darknessCtx.setTransform(1, 0, 0, 1, 0, 0);
  darknessCtx.clearRect(0, 0, darknessCanvas.width, darknessCanvas.height);
  darknessCtx.fillStyle = `rgba(0, 0, 0, ${1 - ambient})`;
  darknessCtx.fillRect(0, 0, darknessCanvas.width, darknessCanvas.height);
  darknessCtx.restore();

  // Punch the light mask out of the darkness, in device space: the mask
  // is the same pixel size as the veil, so its alpha maps 1:1.
  darknessCtx.save();
  darknessCtx.setTransform(1, 0, 0, 1, 0, 0);
  darknessCtx.globalCompositeOperation = 'destination-out';
  darknessCtx.drawImage(lightMaskCanvas, 0, 0);
  darknessCtx.globalCompositeOperation = 'source-over';
  darknessCtx.restore();

  // Composite the darkness over the scene, in device space.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(darknessCanvas, 0, 0);
  ctx.restore();
};
