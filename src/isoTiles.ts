import type { IsoProjection } from './isoProjection';

export const isoTileDimensions = (
  cellSize: number,
  projection: Pick<IsoProjection, 'ax'>,
  scale: number,
  naturalWidth: number,
  naturalHeight: number,
): { width: number; height: number } => {
  const width = cellSize * projection.ax * 2 * scale;
  return { width, height: width * (naturalHeight / naturalWidth) };
};
