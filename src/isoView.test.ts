// The iso view's screen mapping: the camera anchors at the screen
// center, and the world rectangle covering the screen contains every
// screen corner — the invariants the world and light compositing rely
// on for centering and culling.

import { describe, expect, it } from 'vitest';
import {
  createIsoProjection,
  isoPlaneToWorld,
  worldToIsoPlane,
} from './isoProjection';
import { createIsoView, screenWorldBounds, worldToScreen } from './isoView';

// A default 2:1 projection for 32px cells.
const projection = createIsoProjection(32);

describe('createIsoView', () => {
  it('centers the camera on screen', () => {
    const view = createIsoView({ x: 100, y: -40 }, 1024, 768, 32, projection);
    expect(view).toEqual({
      camera: { x: 100, y: -40 },
      width: 1024,
      height: 768,
      projection,
    });
  });

  it('defaults to the 2:1 projection of the cell size', () => {
    const view = createIsoView({ x: 0, y: 0 }, 100, 100, 32);
    expect(view.projection).toEqual(createIsoProjection(32));
  });
});

describe('worldToScreen', () => {
  it('places the camera at the screen center', () => {
    const view = createIsoView({ x: 100, y: -40 }, 1024, 768, 32, projection);
    expect(worldToScreen(view, 100, -40)).toEqual({ x: 512, y: 384 });
  });

  it('preserves iso-plane distances from the anchor', () => {
    const view = createIsoView({ x: 10, y: 10 }, 800, 600, 32, projection);
    const screen = worldToScreen(view, 100, 64);
    const anchor = worldToIsoPlane(projection, 10, 10);
    const plane = worldToIsoPlane(projection, 100, 64);
    expect(screen.x).toBe(plane.x - anchor.x + 400);
    expect(screen.y).toBe(plane.y - anchor.y + 300);
  });
});

describe('screenWorldBounds', () => {
  const view = createIsoView({ x: 500, y: 500 }, 1024, 768, 32, projection);

  it('contains every screen corner, padded', () => {
    const pad = 32;
    const bounds = screenWorldBounds(view, pad);
    for (const [sx, sy] of [
      [0, 0],
      [1024, 0],
      [0, 768],
      [1024, 768],
    ] as Array<[number, number]>) {
      const world = isoPlaneToWorld(
        projection,
        sx - 512 + worldToIsoPlane(projection, 500, 500).x,
        sy - 384 + worldToIsoPlane(projection, 500, 500).y,
      );
      expect(world.x).toBeGreaterThanOrEqual(bounds.minX - pad);
      expect(world.y).toBeGreaterThanOrEqual(bounds.minY - pad);
      expect(world.x).toBeLessThanOrEqual(bounds.maxX + pad);
      expect(world.y).toBeLessThanOrEqual(bounds.maxY + pad);
    }
  });

  it('grows by the pad on every side', () => {
    const tight = screenWorldBounds(view, 0);
    const padded = screenWorldBounds(view, 30);
    expect(padded.minX).toBe(tight.minX - 30);
    expect(padded.minY).toBe(tight.minY - 30);
    expect(padded.maxX).toBe(tight.maxX + 30);
    expect(padded.maxY).toBe(tight.maxY + 30);
  });
});
