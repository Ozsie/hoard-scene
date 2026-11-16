// The isometric world compositing core: flat floor diamonds, a
// painter-ordered queue of extruded wall prisms and upright actors
// (deeper world sums draw in front and occlude), then the additive light
// pass on top — polygons resolved against the consumer's own occlusion
// world, projected here at draw time. Mirrors the dungeon/light cores:
// plain view models only; grids, actors and lights arrive as view data,
// colours and extrusion as resolved palette/content fields.

import { findCell } from './cellVocabulary';
import type { SceneHeroOverlayView, ScenePoint } from './contracts';
import { isoDepth } from './isoProjection';
import { drawIsoPitCells, type SceneIsoPitPainterView } from './isoPits';
import { screenWorldBounds, worldToScreen, type SceneIsoView } from './isoView';

// The culling safety margin beyond the screen's world bounds, on top of
// the wall extrusion height: diamonds hang outside their cells, and
// generous culling is cheaper than precision.
export const ISO_CULL_PAD_PX = 64;

// The isometric world plane, fully resolved: string grid rows over the
// consumer's cell vocabulary (the wall and door tokens below), the cell
// size in world pixels, the prism extrusion height and the paint
// colours — game content, not theme tokens, arriving as view data.
export type SceneIsoWorldView = {
  // String grid rows; each cell renders one diamond (walls extrude).
  rows: string[];
  // World pixels per cell.
  cellSize: number;
  // The token that extrudes as a wall prism.
  wallCell: string;
  // The token drawn in the door colour; every other token is floor.
  doorCell: string;
  // An optional token for cells hidden by the consumer's fog of war.
  hiddenCell?: string;
  floorColors?: (string | undefined)[][];
  floorOverlays?: ({ color: string; opacity: number } | undefined)[][];
  // Optional per-cell image painters. Floor painters replace the flat
  // diamond in the floor pass; wall and door painters join the depth-sorted
  // queue so image geometry can occlude actors correctly.
  floorPainters?: (SceneIsoPainterView | undefined)[][];
  wallPainters?: (SceneIsoPainterView | undefined)[][];
  doorPainters?: (SceneIsoPainterView | undefined)[][];
  pitCells?: ScenePoint[];
  pitPainters?: (SceneIsoPitPainterView | undefined)[][];
  // Optional world-pixel depth enables recessed pit rendering; consumers
  // without it retain the original flat pit fill.
  pitDepthPx?: number;
  // Wall prism extrusion height in screen pixels.
  wallHeightPx: number;
  // The world palette: css colour strings for background, floors,
  // doors and the three wall-prism faces.
  palette: {
    background: string;
    floor: string;
    door: string;
    wallTop: string;
    wallSouth: string;
    wallEast: string;
    pit?: string;
    pitNorth?: string;
    pitWest?: string;
  };
};

// One upright actor drawn at its feet position: a small ground shadow
// plus a flat body. Sprites replace the body rect later; the shadow
// anchors the feet regardless of art. Sizes are half-extents in world
// pixels (mirroring physical bodies), colours are resolved css strings.
export type SceneIsoActorView = {
  feet: ScenePoint;
  halfWidth: number;
  halfHeight: number;
  color: string;
  shadowColor: string;
};

// A game-provided image or prop anchored at a world position. It joins
// walls and actors in the same depth queue so tall art can be occluded.
export type SceneIsoPainterView = {
  position: ScenePoint;
  draw: (ctx: CanvasRenderingContext2D, screenPosition: ScenePoint) => void;
};

// One light resolved for the current frame: center, radius and colour
// resolved by the adapter against its own lighting world; the polygon is
// the lit area in world pixels, computed against the consumer's
// occlusion (with @hoard-engine/lighting or any source of choice).
export type SceneIsoLightView = {
  center: ScenePoint;
  // The light's radius in world pixels.
  radius: number;
  // The light's colour (hex or css) and peak brightness, 0..1.
  color: string;
  intensity: number;
  // The lit-area polygon in world pixels; empty polygons draw nothing.
  polygon: ScenePoint[];
};

type DrawQueueEntry = {
  depth: number;
  draw: () => void;
};

// Fills one cell's flat diamond: floor, or the distinct door tile.
const drawFloorCell = (
  ctx: CanvasRenderingContext2D,
  view: SceneIsoView,
  cellSize: number,
  cellX: number,
  cellY: number,
  color: string,
): void => {
  const left = cellX * cellSize;
  const top = cellY * cellSize;
  const north = worldToScreen(view, left, top);
  const east = worldToScreen(view, left + cellSize, top);
  const south = worldToScreen(view, left + cellSize, top + cellSize);
  const west = worldToScreen(view, left, top + cellSize);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(north.x, north.y);
  ctx.lineTo(east.x, east.y);
  ctx.lineTo(south.x, south.y);
  ctx.lineTo(west.x, west.y);
  ctx.closePath();
  ctx.fill();
};

// Extrudes one wall cell: the visible world-south and world-east faces
// plus the top diamond.
const drawWallCell = (
  ctx: CanvasRenderingContext2D,
  view: SceneIsoView,
  world: SceneIsoWorldView,
  cellX: number,
  cellY: number,
): void => {
  const { cellSize, wallHeightPx, palette } = world;
  const left = cellX * cellSize;
  const top = cellY * cellSize;
  const north = worldToScreen(view, left, top);
  const east = worldToScreen(view, left + cellSize, top);
  const south = worldToScreen(view, left + cellSize, top + cellSize);
  const west = worldToScreen(view, left, top + cellSize);
  const wallHeight = wallHeightPx * view.projection.by;
  const lift = (point: ScenePoint): ScenePoint => ({
    x: point.x,
    y: point.y - wallHeight,
  });

  // Left screen face: world-south edge (west→south ground corners).
  ctx.fillStyle = palette.wallSouth;
  ctx.beginPath();
  ctx.moveTo(west.x, west.y);
  ctx.lineTo(south.x, south.y);
  ctx.lineTo(lift(south).x, lift(south).y);
  ctx.lineTo(lift(west).x, lift(west).y);
  ctx.closePath();
  ctx.fill();

  // Right screen face: world-east edge (south→east ground corners).
  ctx.fillStyle = palette.wallEast;
  ctx.beginPath();
  ctx.moveTo(south.x, south.y);
  ctx.lineTo(east.x, east.y);
  ctx.lineTo(lift(east).x, lift(east).y);
  ctx.lineTo(lift(south).x, lift(south).y);
  ctx.closePath();
  ctx.fill();

  // Top diamond.
  ctx.fillStyle = palette.wallTop;
  ctx.beginPath();
  ctx.moveTo(lift(north).x, lift(north).y);
  ctx.lineTo(lift(east).x, lift(east).y);
  ctx.lineTo(lift(south).x, lift(south).y);
  ctx.lineTo(lift(west).x, lift(west).y);
  ctx.closePath();
  ctx.fill();
};

const drawPitCell = (
  ctx: CanvasRenderingContext2D,
  view: SceneIsoView,
  cellSize: number,
  cellX: number,
  cellY: number,
  color: string,
): void => {
  const left = cellX * cellSize;
  const top = cellY * cellSize;
  const north = worldToScreen(view, left, top);
  const east = worldToScreen(view, left + cellSize, top);
  const south = worldToScreen(view, left + cellSize, top + cellSize);
  const west = worldToScreen(view, left, top + cellSize);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(north.x, north.y);
  ctx.lineTo(east.x, east.y);
  ctx.lineTo(south.x, south.y);
  ctx.lineTo(west.x, west.y);
  ctx.closePath();
  ctx.fill();
};

export const drawIsoHeroOverlay = (
  ctx: CanvasRenderingContext2D,
  view: SceneIsoView,
  overlay: SceneHeroOverlayView,
  cellSize: number,
): void => {
  const projectCell = (x: number, y: number): ScenePoint[] => [
    worldToScreen(view, x * cellSize, y * cellSize),
    worldToScreen(view, (x + 1) * cellSize, y * cellSize),
    worldToScreen(view, (x + 1) * cellSize, (y + 1) * cellSize),
    worldToScreen(view, x * cellSize, (y + 1) * cellSize),
  ];
  const { ax, by } = view.projection;

  ctx.save();
  ctx.strokeStyle = overlay.walkableCellColor ?? 'rgb(10 115 69 / 0.65)';
  ctx.lineWidth = ax;
  for (const cell of overlay.walkableCells) {
    const [north, east, south, west] = projectCell(cell.x, cell.y);
    ctx.beginPath();
    ctx.moveTo(north.x, north.y);
    ctx.lineTo(east.x, east.y);
    ctx.lineTo(south.x, south.y);
    ctx.lineTo(west.x, west.y);
    ctx.closePath();
    ctx.stroke();
  }

  if (overlay.marker) {
    const [north, east, south, west] = projectCell(
      overlay.marker.x,
      overlay.marker.y,
    );
    const corners = [north, east, south, west];
    ctx.strokeStyle = 'lightblue';
    ctx.lineWidth = 2 * ax;
    ctx.beginPath();
    for (let index = 0; index < corners.length; index += 1) {
      const start = corners[index];
      const end = corners[(index + 1) % corners.length];
      if (!start || !end) continue;
      const firstThird = {
        x: start.x + (end.x - start.x) / 3,
        y: start.y + (end.y - start.y) / 3,
      };
      const lastThird = {
        x: start.x + ((end.x - start.x) * 2) / 3,
        y: start.y + ((end.y - start.y) * 2) / 3,
      };
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(firstThird.x, firstThird.y);
      ctx.moveTo(lastThird.x, lastThird.y);
      ctx.lineTo(end.x, end.y);
    }
    ctx.stroke();
  }

  for (const bar of overlay.bars) {
    const center = worldToScreen(
      view,
      (bar.position.x + 0.5) * cellSize,
      (bar.position.y + 0.5) * cellSize,
    );
    const width = cellSize * ax * 0.75;
    const height = 4 * by;
    const left = center.x - width / 2;
    const top = center.y - cellSize * by * 0.55;
    ctx.fillStyle = 'red';
    ctx.fillRect(left, top, width, height);
    ctx.fillStyle = 'green';
    ctx.fillRect(
      left,
      top,
      width * (bar.health.current / Math.max(1, bar.health.max)),
      height,
    );
    ctx.fillStyle = bar.colour;
    ctx.fillRect(left, center.y + cellSize * by * 0.4, width, height);

    ctx.fillStyle = 'darkred';
    for (let index = 0; index < (bar.actionPips ?? 0); index += 1) {
      ctx.fillRect(
        left + index * 6 * ax,
        center.y + cellSize * by * 0.48,
        5 * ax,
        5 * by,
      );
    }
    ctx.fillStyle = 'blue';
    for (let index = 0; index < (bar.movePips ?? 0); index += 1) {
      ctx.fillRect(
        center.x + width / 2 - (index + 1) * 6 * ax,
        center.y + cellSize * by * 0.48,
        5 * ax,
        5 * by,
      );
    }
  }
  ctx.restore();
};

// Draws an upright actor at its feet position.
const drawActor = (
  ctx: CanvasRenderingContext2D,
  view: SceneIsoView,
  actor: SceneIsoActorView,
): void => {
  const feet = worldToScreen(view, actor.feet.x, actor.feet.y);
  const shadowRadius = Math.max(actor.halfWidth * 1.2, 5);
  ctx.fillStyle = actor.shadowColor;
  ctx.beginPath();
  ctx.ellipse(
    feet.x,
    feet.y,
    shadowRadius,
    shadowRadius / 2,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  const bodyWidth = actor.halfWidth * 1.8;
  const bodyHeight = actor.halfHeight * 2.4;
  ctx.fillStyle = actor.color;
  ctx.fillRect(
    feet.x - bodyWidth / 2,
    feet.y - bodyHeight,
    bodyWidth,
    bodyHeight,
  );
};

// One full isometric world pass: the dark base, then floor diamonds,
// then the painter queue of wall prisms and actors sorted by world
// depth (walls at their cell-center sum, actors at their feet) — deeper
// draws in front.
export const drawIsoWorldFrame = (
  ctx: CanvasRenderingContext2D,
  world: SceneIsoWorldView,
  view: SceneIsoView,
  actors: SceneIsoActorView[],
  painters: SceneIsoPainterView[] = [],
): void => {
  ctx.fillStyle = world.palette.background;
  ctx.fillRect(0, 0, view.width, view.height);

  const { cellSize } = world;
  const bounds = screenWorldBounds(view, world.wallHeightPx + ISO_CULL_PAD_PX);
  const widthCells = Math.max(...world.rows.map((row) => row.length));
  const firstX = Math.max(0, Math.floor(bounds.minX / cellSize));
  const lastX = Math.min(widthCells - 1, Math.ceil(bounds.maxX / cellSize));
  const firstY = Math.max(0, Math.floor(bounds.minY / cellSize));
  const lastY = Math.min(
    world.rows.length - 1,
    Math.ceil(bounds.maxY / cellSize),
  );

  const queue: DrawQueueEntry[] = [];
  const pitCells = new Set(
    (world.pitCells ?? []).map(
      (point) => `${String(point.x)},${String(point.y)}`,
    ),
  );
  for (let cellY = firstY; cellY <= lastY; cellY += 1) {
    for (let cellX = firstX; cellX <= lastX; cellX += 1) {
      const cell = findCell(world.rows, cellX, cellY);
      if (world.hiddenCell !== undefined && cell === world.hiddenCell) continue;
      if (cell === world.wallCell) {
        const x = cellX;
        const y = cellY;
        const painter = world.wallPainters?.[cellY]?.[cellX];
        queue.push({
          depth: isoDepth((x + 0.5) * cellSize, (y + 0.5) * cellSize),
          draw: () =>
            painter
              ? painter.draw(
                  ctx,
                  worldToScreen(view, painter.position.x, painter.position.y),
                )
              : drawWallCell(ctx, view, world, x, y),
        });
      } else {
        const key = `${String(cellX)},${String(cellY)}`;
        if (pitCells.has(key)) {
          if (world.pitDepthPx !== undefined) {
            continue;
          } else {
            drawPitCell(
              ctx,
              view,
              cellSize,
              cellX,
              cellY,
              world.palette.pit ?? world.palette.background,
            );
          }
          continue;
        }
        const color =
          cell === world.doorCell
            ? world.palette.door
            : (world.floorColors?.[cellY]?.[cellX] ?? world.palette.floor);
        const painter = world.floorPainters?.[cellY]?.[cellX];
        if (painter) {
          painter.draw(
            ctx,
            worldToScreen(view, painter.position.x, painter.position.y),
          );
        } else {
          drawFloorCell(ctx, view, cellSize, cellX, cellY, color);
        }
        if (cell === world.doorCell) {
          const painter = world.doorPainters?.[cellY]?.[cellX];
          if (painter) {
            queue.push({
              depth: isoDepth(
                (cellX + 0.5) * cellSize,
                (cellY + 0.5) * cellSize,
              ),
              draw: () =>
                painter.draw(
                  ctx,
                  worldToScreen(view, painter.position.x, painter.position.y),
                ),
            });
          }
        }
        const overlay = world.floorOverlays?.[cellY]?.[cellX];
        if (overlay) {
          ctx.save();
          ctx.globalAlpha = overlay.opacity;
          drawFloorCell(ctx, view, cellSize, cellX, cellY, overlay.color);
          ctx.restore();
        }
      }
    }
  }
  if (world.pitDepthPx !== undefined) {
    drawIsoPitCells(ctx, view, {
      cellSize,
      cells: (world.pitCells ?? [])
        .filter(({ x, y }) => {
          const cell = findCell(world.rows, x, y);
          return (
            cell !== undefined &&
            cell !== world.wallCell &&
            (world.hiddenCell === undefined || cell !== world.hiddenCell)
          );
        })
        .map(({ x, y }) => ({
          x,
          y,
          painter: world.pitPainters?.[y]?.[x],
        })),
      depthPx: world.pitDepthPx,
      bottomColor: world.palette.pit ?? world.palette.background,
      northWallColor: world.palette.pitNorth ?? world.palette.wallSouth,
      westWallColor: world.palette.pitWest ?? world.palette.wallEast,
    });
  }
  for (const actor of actors) {
    queue.push({
      depth: isoDepth(actor.feet.x, actor.feet.y),
      draw: () => drawActor(ctx, view, actor),
    });
  }
  for (const painter of painters) {
    queue.push({
      depth: isoDepth(painter.position.x, painter.position.y),
      draw: () =>
        painter.draw(
          ctx,
          worldToScreen(view, painter.position.x, painter.position.y),
        ),
    });
  }
  queue.sort((a, b) => a.depth - b.depth);
  for (const entry of queue) {
    entry.draw();
  }
};

// The additive light pass: resolved lit-area polygons clipped and filled
// with a squished radial gradient (the projection of a ground-plane
// disk). The consumer resolves and culls the lights (polygon, animated
// center, brightness) against its own occlusion world; this draws what
// remains.
export const drawIsoLights = (
  ctx: CanvasRenderingContext2D,
  view: SceneIsoView,
  lights: SceneIsoLightView[],
): void => {
  const { ax, by } = view.projection;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const light of lights) {
    if (light.polygon.length < 3) continue;
    const centerScreen = worldToScreen(view, light.center.x, light.center.y);
    const radiusScreen = light.radius * ax;
    ctx.save();
    ctx.beginPath();
    const first = worldToScreen(view, light.polygon[0].x, light.polygon[0].y);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < light.polygon.length; i += 1) {
      const p = worldToScreen(view, light.polygon[i].x, light.polygon[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.clip();
    // The projected disk is an ellipse: squish the vertical axis and
    // paint a circular gradient in the squished space.
    ctx.translate(centerScreen.x, centerScreen.y);
    if (ax !== by) {
      ctx.scale(1, by / ax);
    }
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusScreen);
    const intensityHex = Math.round(light.intensity * 255)
      .toString(16)
      .padStart(2, '0');
    gradient.addColorStop(0, `${light.color}${intensityHex}`);
    gradient.addColorStop(1, `${light.color}00`);
    ctx.fillStyle = gradient;
    ctx.fillRect(
      -radiusScreen,
      -radiusScreen,
      radiusScreen * 2,
      radiusScreen * 2,
    );
    ctx.restore();
  }
  ctx.restore();
};
