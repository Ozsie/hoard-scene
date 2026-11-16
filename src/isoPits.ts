import type { ScenePoint } from './contracts';
import { worldToScreen, type SceneIsoView } from './isoView';

export type SceneIsoPitEdge = 'north' | 'west';

export type SceneIsoPitFaceView = {
  edge: SceneIsoPitEdge;
  points: [ScenePoint, ScenePoint, ScenePoint, ScenePoint];
};

export type SceneIsoPitPainterView = {
  drawFace: (ctx: CanvasRenderingContext2D, face: SceneIsoPitFaceView) => void;
};

export type SceneIsoPitCellView = {
  x: number;
  y: number;
  painter?: SceneIsoPitPainterView;
};

const tracePolygon = (
  ctx: CanvasRenderingContext2D,
  points: ScenePoint[],
  beginPath = true,
): void => {
  const [first, ...rest] = points;
  if (!first) return;
  if (beginPath) ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (const point of rest) ctx.lineTo(point.x, point.y);
  ctx.closePath();
};

const drawPolygon = (
  ctx: CanvasRenderingContext2D,
  points: ScenePoint[],
): void => {
  tracePolygon(ctx, points);
  ctx.fill();
};

export const getIsoPitFaces = (
  view: SceneIsoView,
  cellSize: number,
  x: number,
  y: number,
  depthPx: number,
  hasPit: (x: number, y: number) => boolean,
): SceneIsoPitFaceView[] => {
  const left = x * cellSize;
  const top = y * cellSize;
  const north = worldToScreen(view, left, top);
  const east = worldToScreen(view, left + cellSize, top);
  const west = worldToScreen(view, left, top + cellSize);
  const depth = depthPx * view.projection.by;
  const lower = (point: ScenePoint): ScenePoint => ({
    x: point.x,
    y: point.y + depth,
  });
  const faces: SceneIsoPitFaceView[] = [];

  if (!hasPit(x, y - 1)) {
    faces.push({
      edge: 'north',
      points: [north, east, lower(east), lower(north)],
    });
  }
  if (!hasPit(x - 1, y)) {
    faces.push({
      edge: 'west',
      points: [west, north, lower(north), lower(west)],
    });
  }

  return faces;
};

export const drawIsoPitCell = (
  ctx: CanvasRenderingContext2D,
  view: SceneIsoView,
  options: {
    cellSize: number;
    x: number;
    y: number;
    depthPx: number;
    bottomColor: string;
    northWallColor: string;
    westWallColor: string;
    hasPit: (x: number, y: number) => boolean;
    painter?: SceneIsoPitPainterView;
  },
): void => {
  const {
    cellSize,
    x,
    y,
    depthPx,
    bottomColor,
    northWallColor,
    westWallColor,
  } = options;
  const left = x * cellSize;
  const top = y * cellSize;
  const depth = depthPx * view.projection.by;
  const north = worldToScreen(view, left, top);
  const east = worldToScreen(view, left + cellSize, top);
  const south = worldToScreen(view, left + cellSize, top + cellSize);
  const west = worldToScreen(view, left, top + cellSize);
  const opening = [north, east, south, west];
  const bottom = opening.map((point) => ({
    x: point.x,
    y: point.y + depth,
  }));

  ctx.save();
  tracePolygon(ctx, opening);
  ctx.clip();
  ctx.fillStyle = bottomColor;
  drawPolygon(ctx, bottom);

  for (const face of getIsoPitFaces(
    view,
    cellSize,
    x,
    y,
    depthPx,
    options.hasPit,
  )) {
    ctx.fillStyle = face.edge === 'north' ? northWallColor : westWallColor;
    drawPolygon(ctx, face.points);
    if (options.painter) {
      ctx.save();
      tracePolygon(ctx, face.points);
      ctx.clip();
      options.painter.drawFace(ctx, face);
      ctx.restore();
    }
  }
  ctx.restore();
};

export const drawIsoPitCells = (
  ctx: CanvasRenderingContext2D,
  view: SceneIsoView,
  options: {
    cellSize: number;
    cells: SceneIsoPitCellView[];
    depthPx: number;
    bottomColor: string;
    northWallColor: string;
    westWallColor: string;
  },
): void => {
  const {
    cellSize,
    cells,
    depthPx,
    bottomColor,
    northWallColor,
    westWallColor,
  } = options;
  const remaining = new Map(
    cells.map((cell): [string, SceneIsoPitCellView] => [
      `${String(cell.x)},${String(cell.y)}`,
      cell,
    ]),
  );
  const components: SceneIsoPitCellView[][] = [];

  while (remaining.size > 0) {
    const first = remaining.values().next().value;
    if (!first) break;
    const component: SceneIsoPitCellView[] = [];
    const pending = [first];
    remaining.delete(`${String(first.x)},${String(first.y)}`);

    while (pending.length > 0) {
      const cell = pending.pop();
      if (!cell) continue;
      component.push(cell);
      for (const [x, y] of [
        [cell.x - 1, cell.y],
        [cell.x + 1, cell.y],
        [cell.x, cell.y - 1],
        [cell.x, cell.y + 1],
      ]) {
        const key = `${String(x)},${String(y)}`;
        const neighbor = remaining.get(key);
        if (!neighbor) continue;
        pending.push(neighbor);
        remaining.delete(key);
      }
    }
    components.push(component);
  }

  for (const component of components) {
    const componentCells = new Set(
      component.map((cell) => `${String(cell.x)},${String(cell.y)}`),
    );
    const hasPit = (x: number, y: number): boolean =>
      componentCells.has(`${String(x)},${String(y)}`);

    ctx.save();
    ctx.beginPath();
    for (const cell of component) {
      const left = cell.x * cellSize;
      const top = cell.y * cellSize;
      tracePolygon(
        ctx,
        [
          worldToScreen(view, left, top),
          worldToScreen(view, left + cellSize, top),
          worldToScreen(view, left + cellSize, top + cellSize),
          worldToScreen(view, left, top + cellSize),
        ],
        false,
      );
    }
    ctx.clip();

    const depth = depthPx * view.projection.by;
    for (const cell of component) {
      const left = cell.x * cellSize;
      const top = cell.y * cellSize;
      const opening = [
        worldToScreen(view, left, top),
        worldToScreen(view, left + cellSize, top),
        worldToScreen(view, left + cellSize, top + cellSize),
        worldToScreen(view, left, top + cellSize),
      ];
      ctx.fillStyle = bottomColor;
      drawPolygon(
        ctx,
        opening.map((point) => ({ x: point.x, y: point.y + depth })),
      );
    }

    for (const cell of component) {
      for (const face of getIsoPitFaces(
        view,
        cellSize,
        cell.x,
        cell.y,
        depthPx,
        hasPit,
      )) {
        ctx.fillStyle = face.edge === 'north' ? northWallColor : westWallColor;
        drawPolygon(ctx, face.points);
        if (cell.painter) {
          ctx.save();
          tracePolygon(ctx, face.points);
          ctx.clip();
          cell.painter.drawFace(ctx, face);
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }
};
