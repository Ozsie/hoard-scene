// Local cell-string helpers and cell tokens — the two-field
// duplicates the boundary rules prefer over a dependency edge
// (docs/engine-packages.md, dependency rule 3: no shared types hub).
// The token values mirror the grid engine package's cell vocabulary, so
// consumer grids authored with those tokens pass unmodified.

export const EMPTY = ' ';
export const COLLAPSED = '?';
export const SEALED_DOOR = '+';
export const WALL = '#';

export const toArray = (row: string): string[] => {
  const array: string[] = [];
  for (let i = 0; i < row.length; i++) {
    array.push(row[i]);
  }
  return array;
};

export const findCell = (grid: string[], x: number, y: number): string =>
  grid[y]?.[x] ?? '';

export const isSamePosition = (
  a: { x: number; y: number },
  b: { x: number; y: number },
): boolean => a.x === b.x && a.y === b.y;

// The corner-type vocabulary for the corner caps the renderer paints —
// a const object with the grid engine package's member values, so corner
// data from any consumer that classifies with that vocabulary stays
// structurally compatible without an import edge.
export const CornerType = {
  INNER_BOTTOM_RIGHT: 'IBR',
  INNER_TOP_RIGHT: 'ITR',
  INNER_BOTTOM_LEFT: 'IBL',
  INNER_TOP_LEFT: 'ITL',
  OUTER_BOTTOM_RIGHT: 'OBR',
  OUTER_TOP_RIGHT: 'OTR',
  OUTER_BOTTOM_LEFT: 'OBL',
  OUTER_TOP_LEFT: 'OTL',
  BOTTOM_END: 'BE',
  TOP_END: 'TE',
  LEFT_END: 'LE',
  RIGHT_END: 'RE',
  FOUR_WAY_INTERSECTION: 'I',
  THREE_WAY_INTERSECTION_UP_CLOSED: 'TUC',
  THREE_WAY_INTERSECTION_UP: 'TUO',
  THREE_WAY_INTERSECTION_DOWN: 'TD',
  THREE_WAY_INTERSECTION_LEFT: 'TL',
  THREE_WAY_INTERSECTION_RIGHT: 'TR',
  NOT_CORNER: 'NC',
} as const;

export type CornerType = (typeof CornerType)[keyof typeof CornerType];

// The light-effect vocabulary referenced by `SceneLightView.effect` —
// the lighting engine's member values, re-declared so the view stays a
// plain string and the package needs no import edge.
export const LightEffect = {
  STATIC: 'static',
  PULSE: 'pulse',
  FLICKER: 'flicker',
  SWEEP: 'sweep',
  SWAY: 'sway',
  BLINK: 'blink',
  SPARKLE: 'sparkle',
  AURA: 'aura',
  GAS: 'gas',
} as const;

export type LightEffect =
  (typeof LightEffect)[keyof typeof LightEffect] | (string & {});

// The animated terrain-overlay styles the renderer draws on the dynamic
// layer — the adapter resolves its terrain types into these names
// (absent overlay: the cell renders its static fill only).
export const TERRAIN_OVERLAY = {
  WATER: 'water',
  LAVA: 'lava',
} as const;
