// Dungeon-plane view contracts — the second seam the @hoard-engine/scene
// renderer consumes: the static world layers (grid, walls, doors,
// secrets, terrain, fog, pillars, pits, interactables, portal, corners)
// read only these plain shapes. Consumers pass their own layout data —
// the fields these types declare are all the renderer reads
// (docs/engine-packages.md, dependency rule 1: consumer-defined
// contracts, structural compatibility, no shared import).

import type { ScenePoint } from './contracts';

// The four shared cell-edge directions of doors and edge walls. Consumer
// enums carrying exactly these strings pass by structural compatibility
// without a shared import.
export type SceneSide = 'Left' | 'Right' | 'Up' | 'Down';

// A door on the edge between two cells — closed, open, hidden or
// trapped; the paint rules live with the renderer.
export type SceneDoor = {
  x: number;
  y: number;
  side: SceneSide;
  open: boolean;
  hidden?: boolean;
  locked?: boolean;
  trapped?: boolean;
  trapAttacks?: number;
};

// A wall on the shared edge of two floor cells, not a full grid cell.
export type SceneEdgeWall = {
  x: number;
  y: number;
  side: SceneSide;
  colour?: string;
};

// A secret on the floor: `type` is an open string (the consumer's secret
// vocabulary); unknown types render as the generic marker.
export type SceneSecret = {
  position: ScenePoint;
  found: boolean;
  type: string;
};

// A floor cell with a terrain material (water, lava, ...). Color,
// opacity and rate are resolved by the adapter (the consumer applies its
// type-specific styling before emitting the cell); the renderer falls
// back to neutral values for absent fields. `overlay` names the
// animated overlay style the renderer draws on the dynamic layer
// ('water' shimmer, 'lava' pulse) — the adapter resolves it from the
// terrain type; cells without an overlay render their static fill only.
export type SceneTerrainCell = {
  position: ScenePoint;
  type: string;
  overlay?: string;
  color?: string;
  opacity?: number;
  rate?: number;
};

// Atmospheric fog filling every cell of a room or corridor.
export type SceneFogOptions = {
  color?: string;
  opacity?: number;
  rate?: number;
  softness?: number;
  density?: number;
  blocksLight?: boolean;
};

// An interactable cell on the floor.
export type SceneInteractable = {
  position: ScenePoint;
  effect: string;
  secret?: boolean;
};

// A classified corner: `type` is a string from the corner-type
// vocabulary (the grid engine package owns its reference const object;
// this package re-declares the same member values locally, so corner
// data passes by structural compatibility).
export type SceneCorner = {
  position: ScenePoint;
  type: string;
};

// The whole dungeon plane the renderer consumes: grid letters, doors,
// walls, terrain, fog, pillars, pits, secrets, interactables, the
// portal, the discovered-room set that resolves visibility and the
// classified corners. Corner data is resolved by the adapter (the
// consumer runs its corner classification — including its own
// fog-of-war and door-sealing rules — and hands the result over);
// absent corners render the wall cells unclassified. Nothing beyond
// these fields is read.
export type SceneDungeonView = {
  name: string;
  discoveredRooms: string[];
  portal?: ScenePoint;
  layout: {
    grid: string[];
    doors: SceneDoor[];
    walls?: SceneEdgeWall[];
    secrets: SceneSecret[];
    terrain?: SceneTerrainCell[];
    roomFog?: Record<string, SceneFogOptions>;
    pillars?: ScenePoint[];
    pits?: ScenePoint[];
    interactables?: SceneInteractable[];
    // The classified corners and the fog-of-war-sealed cell grid the
    // consumer resolved for its current visible state (see below); the
    // renderer runs no detection of its own.
    corners?: SceneCorner[];
    sealedGrid?: string[];
    wallColour?: string;
  };
};
