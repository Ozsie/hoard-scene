// Resolved-text label boxes: a wrapped, rounded label drawn under the
// cell it describes (item labels, floor notes). The text arrives
// resolved — translated by the consumer — so no i18n knowledge exists
// here.

import type { ScenePoint } from './contracts';

// Draws the wrapped label box below the given cell.
export const drawLabelBox = (
  ctx: CanvasRenderingContext2D,
  text: string,
  position: ScenePoint,
  cellSize: number,
): void => {
  const lines = text.match(/.{1,30}(?:\s|$)/g);

  const x = position.x * cellSize;
  const y = position.y * cellSize + cellSize;
  const height = Math.max(lines?.length ?? 0, 1) * (cellSize / 2.5);
  ctx.fillStyle = 'rgba(82,11,159,0.8)';
  ctx.beginPath();
  ctx.roundRect(x, y, cellSize * 4, height, [0, 30, 30, 30]);
  // The stroke must come before the fill to keep the historical outline.
  ctx.stroke();
  ctx.fill();
  ctx.font = '12px Arial';
  ctx.fillStyle = 'wheat';
  lines?.forEach((line, index) => {
    ctx.fillText(line, x + 10, y + 14 * (index + 1));
  });
};
