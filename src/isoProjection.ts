// The isometric projection between a simulated top-down plane and the
// screen: the world is simulated strictly top-down (world pixels, tile
// grid — physics, lighting and pathfinding never see the projection),
// and only the renderer looks through here. Standard 2:1 diamonds: one
// cell renders `tileWidth` wide and `tileHeight` tall (defaults 2:1 of
// the cell size), so iso-x walks screen (ax, by) and iso-y walks
// (-ax, by).

export type IsoProjection = {
  // Horizontal scale: screen px per world px along the world x axis.
  ax: number;
  // Vertical scale: screen px per world px along the world y axis.
  by: number;
};

// A 2:1 projection for the given cell size: a 32px cell is drawn as a
// 64x32 diamond.
export const createIsoProjection = (
  cellSize: number,
  tileWidth: number = cellSize * 2,
  tileHeight: number = cellSize,
): IsoProjection => ({
  ax: tileWidth / (2 * cellSize),
  by: tileHeight / (2 * cellSize),
});

// A world-plane point in world pixels → the iso plane (world-relative).
export const worldToIsoPlane = (
  projection: IsoProjection,
  wx: number,
  wy: number,
): { x: number; y: number } => ({
  x: (wx - wy) * projection.ax,
  y: (wx + wy) * projection.by,
});

// The inverse: an iso-plane point → the world plane.
export const isoPlaneToWorld = (
  projection: IsoProjection,
  ix: number,
  iy: number,
): { x: number; y: number } => ({
  x: (ix / projection.ax + iy / projection.by) / 2,
  y: (iy / projection.by - ix / projection.ax) / 2,
});

// Painter's-algorithm depth for a world-plane point: cells and actors at
// greater sums draw in front and occlude what is behind them. Walls use
// their cell-center sum, actors their feet position.
export const isoDepth = (wx: number, wy: number): number => wx + wy;

// Screen-relative controls: the direction on screen the player asks for
// (right/down positive, screen pixels' axes) → the world-plane unit
// vector that projects to it. Under the 2:1 projection "screen up" is the
// world (−x, −y) diagonal and "screen right" is (+x, −y); the result is
// normalized, so up-and-right together move the same world speed as up
// alone. The zero vector maps to zero.
export const screenDirectionToWorld = (
  projection: IsoProjection,
  screenX: number,
  screenY: number,
): { x: number; y: number } => {
  const rawX = screenX / projection.ax + screenY / projection.by;
  const rawY = screenY / projection.by - screenX / projection.ax;
  const length = Math.hypot(rawX, rawY);
  if (length === 0) {
    return { x: 0, y: 0 };
  }
  return { x: rawX / length, y: rawY / length };
};
