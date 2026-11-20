import { renderFogLightDim } from './dungeonCanvas';
import type { SceneDungeonView } from './dungeonView';
import { worldToScreen, type SceneIsoView } from './isoView';

export const drawIsoFogLightDim = (
  ctx: CanvasRenderingContext2D,
  cellSize: number,
  dungeon: SceneDungeonView,
  view: SceneIsoView,
  pixelRatio: number,
): void => {
  if (pixelRatio <= 0) return;
  const { ax, by } = view.projection;
  const origin = worldToScreen(view, 0, 0);
  ctx.save();
  ctx.setTransform(
    pixelRatio * ax,
    pixelRatio * by,
    -pixelRatio * ax,
    pixelRatio * by,
    pixelRatio * origin.x,
    pixelRatio * origin.y,
  );
  renderFogLightDim(ctx, cellSize, dungeon, false);
  ctx.restore();
};
