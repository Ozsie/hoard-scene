// Iso-plane view contracts — the seam the @hoard-engine/scene isometric
// compositing (isoCanvas.ts) consumes: a screen view seen through the
// isometric projection. Pure screen mapping over view data, mirroring
// the dungeon and light view modules: a follow camera is just its
// world-plane anchor point, so cameras pass by structural compatibility.

import type { ScenePoint } from './contracts';
import {
  createIsoProjection,
  isoPlaneToWorld,
  worldToIsoPlane,
  type IsoProjection,
} from './isoProjection';

// The camera's world-plane anchor point — structurally compatible with
// any consumer follow camera; the view centers on it.
export type SceneIsoCamera = {
  x: number;
  y: number;
};

// Everything the screen rectangle needs: the camera world position, the
// canvas size and the projection factors.
export type SceneIsoView = {
  camera: SceneIsoCamera;
  width: number;
  height: number;
  projection: IsoProjection;
};

// An iso view of the given canvas size, centered on the camera, over a
// 2:1 projection of the cell size (or a custom one).
export const createIsoView = (
  camera: SceneIsoCamera,
  width: number,
  height: number,
  cellSize: number,
  projection: IsoProjection = createIsoProjection(cellSize),
): SceneIsoView => ({
  camera,
  width,
  height,
  projection,
});

// A world-plane point in world pixels → canvas pixels on screen.
export const worldToScreen = (
  view: SceneIsoView,
  wx: number,
  wy: number,
): ScenePoint => {
  const anchor = worldToIsoPlane(view.projection, view.camera.x, view.camera.y);
  const plane = worldToIsoPlane(view.projection, wx, wy);
  return {
    x: plane.x - anchor.x + view.width / 2,
    y: plane.y - anchor.y + view.height / 2,
  };
};

// The world-plane rectangle covering the screen: inverse-project the four
// corners and pad by `padPx` (the consumer's wall extrusion height plus
// the culling safety margin), so the tile pass can cull in world space.
// Padded generously — culling is cheaper than precision.
export const screenWorldBounds = (
  view: SceneIsoView,
  padPx: number,
): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} => {
  const anchor = worldToIsoPlane(view.projection, view.camera.x, view.camera.y);
  const corners: Array<[number, number]> = [
    [0, 0],
    [view.width, 0],
    [0, view.height],
    [view.width, view.height],
  ];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [sx, sy] of corners) {
    const world = isoPlaneToWorld(
      view.projection,
      sx - view.width / 2 + anchor.x,
      sy - view.height / 2 + anchor.y,
    );
    minX = Math.min(minX, world.x);
    minY = Math.min(minY, world.y);
    maxX = Math.max(maxX, world.x);
    maxY = Math.max(maxY, world.y);
  }
  return {
    minX: minX - padPx,
    minY: minY - padPx,
    maxX: maxX + padPx,
    maxY: maxY + padPx,
  };
};
