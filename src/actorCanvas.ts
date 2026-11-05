// The actor/item/overlay compositing: the view-typed cores that draw one
// SceneActorView, one SceneItemView and the SceneHeroOverlayView turn UI.
// The consumer resolves its game state into these views (adapters, game
// side); nothing here knows a game type.

import type {
  SceneActorView,
  SceneHeroOverlayView,
  SceneItemView,
} from './contracts';
import {
  drawColourBar,
  drawFlash,
  drawHealthBar,
  drawSpriteFrame,
  drawTileFrame,
} from './actorLayer';
import { drawLabelBox } from './textboxes';

// Draws one actor view: the sprite or fallback tile, the damage flash,
// the colour bar, the health bar and the debug extras. Returns whether
// the actor's motion or sprite animation may still advance.
export const renderActorView = (
  ctx: CanvasRenderingContext2D,
  view: SceneActorView,
  cellSize: number,
): boolean => {
  const { x, y } = view.position;
  if (view.sprite) {
    drawSpriteFrame(ctx, view.sprite, x, y, cellSize);
  } else if (view.tile) {
    drawTileFrame(ctx, view.tile, x * cellSize, y * cellSize);
  }
  drawFlash(ctx, view.position, view.flashIntensity, cellSize);
  if (view.colourBar) {
    drawColourBar(ctx, view.position, view.colourBar, cellSize);
  }
  if (view.healthBar) {
    drawHealthBar(ctx, view.position, view.healthBar, cellSize);
  }
  view.debugLines.forEach((line) => {
    ctx.beginPath();
    ctx.strokeStyle = line.colour;
    ctx.lineWidth = 2;
    ctx.moveTo(
      line.from.x * cellSize + cellSize / 2,
      line.from.y * cellSize + cellSize / 2,
    );
    ctx.lineTo(
      line.to.x * cellSize + cellSize / 2,
      line.to.y * cellSize + cellSize / 2,
    );
    ctx.stroke();
    ctx.lineWidth = 1;
  });
  // Debug cell coordinates drawn next to the actor (debug mode only).
  if (view.debugLabel) {
    ctx.fillStyle = 'black';
    ctx.font = '8px Arial';
    ctx.fillText(view.debugLabel, x * cellSize + 3, y * cellSize + 10);
  }
  return view.active;
};

// Draws one item view: the item sprite or generic fallback tile, plus
// the resolved label while a hero stands on it.
export const renderItemView = (
  ctx: CanvasRenderingContext2D,
  view: SceneItemView,
  cellSize: number,
): void => {
  const { x, y } = view.position;
  // Item sprite sheet when the item defines one, the generic tileset item
  // tile otherwise (and while the sheet is still loading).
  if (view.sprite) {
    drawSpriteFrame(ctx, view.sprite, x, y, cellSize);
  } else {
    drawTileFrame(ctx, view.fallbackTile, x * cellSize, y * cellSize);
  }
  if (view.label) {
    drawLabelBox(ctx, view.label, view.position, cellSize);
  }
};

// Draws the hero turn UI — the walkable area outline, the per-hero bars
// and pips, and the current-actor reticule. Called by the renderer after
// the light mask and the ambient darkness veil, so these stay fully
// visible even on unlit cells.
export const renderHeroOverlay = (
  ctx: CanvasRenderingContext2D,
  view: SceneHeroOverlayView,
  cellSize: number,
): void => {
  // An outline rather than a tint: it marks the cell without covering
  // the floor and lighting beneath it.
  ctx.strokeStyle = 'rgb(10 115 69 / 0.65)';
  ctx.lineWidth = 1;
  view.walkableCells.forEach((cell) => {
    ctx.strokeRect(cell.x * cellSize, cell.y * cellSize, cellSize, cellSize);
  });

  view.bars.forEach((bar) => {
    renderActionPips(ctx, bar, cellSize);
    drawColourBar(ctx, bar.position, bar.colour, cellSize);
    drawHealthBar(ctx, bar.position, bar.health, cellSize);
  });

  renderCurrentActorMarker(ctx, view.marker, cellSize);
};

const renderActionPips = (
  ctx: CanvasRenderingContext2D,
  bar: SceneHeroOverlayView['bars'][number],
  cellSize: number,
): void => {
  const { position, actionPips, movePips } = bar;
  const x = position.x;
  const y = position.y;
  const prevFillStyle = ctx.fillStyle;
  const prevStrokeStyle = ctx.strokeStyle;

  ctx.strokeStyle = '#080808';
  ctx.fillStyle = 'darkred';
  for (let index = 0; index < (actionPips ?? 0); index++) {
    ctx.fillRect(
      x * cellSize + 4 + 6 * index,
      y * cellSize + cellSize - 12,
      5,
      5,
    );
    ctx.rect(x * cellSize + 4 + 6 * index, y * cellSize + cellSize - 12, 5, 5);
    ctx.stroke();
  }

  ctx.fillStyle = 'blue';
  for (let index = 0; index < (movePips ?? 0); index++) {
    ctx.fillRect(
      x * cellSize + cellSize - 22 + 6 * index,
      y * cellSize + cellSize - 12,
      5,
      5,
    );
    ctx.rect(
      x * cellSize + cellSize - 22 + 6 * index,
      y * cellSize + cellSize - 12,
      5,
      5,
    );
    ctx.stroke();
  }

  ctx.fillStyle = prevFillStyle;
  ctx.strokeStyle = prevStrokeStyle;
};

const renderCurrentActorMarker = (
  ctx: CanvasRenderingContext2D,
  marker: SceneHeroOverlayView['marker'],
  cellSize: number,
): void => {
  if (!marker) return;
  const x = marker.x;
  const y = marker.y;
  ctx.beginPath();
  ctx.strokeStyle = 'lightblue';
  ctx.lineWidth = 2;

  ctx.moveTo(x * cellSize, y * cellSize);
  ctx.lineTo(x * cellSize + cellSize / 3, y * cellSize);
  ctx.moveTo(x * cellSize, y * cellSize);
  ctx.lineTo(x * cellSize, y * cellSize + cellSize / 3);

  ctx.moveTo(x * cellSize + cellSize, y * cellSize);
  ctx.lineTo(x * cellSize + (cellSize / 3) * 2, y * cellSize);
  ctx.moveTo(x * cellSize + cellSize, y * cellSize);
  ctx.lineTo(x * cellSize + cellSize, y * cellSize + cellSize / 3);

  ctx.moveTo(x * cellSize, y * cellSize + cellSize);
  ctx.lineTo(x * cellSize, y * cellSize + (cellSize / 3) * 2);
  ctx.moveTo(x * cellSize, y * cellSize + cellSize);
  ctx.lineTo(x * cellSize + cellSize / 3, y * cellSize + cellSize);

  ctx.moveTo(x * cellSize + cellSize, y * cellSize + cellSize);
  ctx.lineTo(x * cellSize + cellSize, y * cellSize + (cellSize / 3) * 2);
  ctx.moveTo(x * cellSize + cellSize, y * cellSize + cellSize);
  ctx.lineTo(x * cellSize + (cellSize / 3) * 2, y * cellSize + cellSize);
  ctx.stroke();
  ctx.lineWidth = 1;
};
