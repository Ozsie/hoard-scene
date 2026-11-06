// The isometric projection's pure math: cell-diamond shapes, plane
// round trips, painter depth ordering and the screen-direction mapping
// — the drawing cores consume these, so the invariants live here.

import { describe, expect, it } from 'vitest';
import {
  createIsoProjection,
  isoDepth,
  isoPlaneToWorld,
  screenDirectionToWorld,
  worldToIsoPlane,
} from './isoProjection';

// The default 2:1 projection for 32px cells.
const iso = createIsoProjection(32);

describe('createIsoProjection', () => {
  it('scales a cell to a 2:1 diamond', () => {
    // All four corners of cell (0,0) — a 32x32 world square — map to a
    // 64x32 diamond on the iso plane.
    const north = worldToIsoPlane(iso, 0, 0);
    const east = worldToIsoPlane(iso, 32, 0);
    const south = worldToIsoPlane(iso, 32, 32);
    const west = worldToIsoPlane(iso, 0, 32);
    expect(north).toEqual({ x: 0, y: 0 });
    expect(east).toEqual({ x: 32, y: 16 });
    expect(south).toEqual({ x: 0, y: 32 });
    expect(west).toEqual({ x: -32, y: 16 });
    expect(south.x - west.x).toBe(32); // diamond half-width from center
    expect(south.y - north.y).toBe(32); // full height
    // Full diamond spans east..west horizontally.
    expect(east.x - west.x).toBe(64);
  });

  it('supports custom tile aspect', () => {
    const tall = createIsoProjection(32, 64, 48);
    expect(tall.ax).toBe(1);
    expect(tall.by).toBe(0.75);
  });
});

describe('iso plane round trip', () => {
  it('inverts worldToIsoPlane', () => {
    const points: Array<[number, number]> = [
      [0, 0],
      [33, -12],
      [704.5, 128.25],
    ];
    for (const [wx, wy] of points) {
      const plane = worldToIsoPlane(iso, wx, wy);
      expect(isoPlaneToWorld(iso, plane.x, plane.y)).toEqual({ x: wx, y: wy });
    }
  });
});

describe('isoDepth', () => {
  it('orders further-front cells greater than behind cells', () => {
    // A wall at (2,2) occludes a cell at (1,1).
    expect(isoDepth(64, 64)).toBeGreaterThan(isoDepth(32, 32));
  });

  it('is equal along the diagonal bands of one diamond row', () => {
    expect(isoDepth(32, 0)).toBe(isoDepth(0, 32));
  });
});

describe('screenDirectionToWorld', () => {
  const DIAGONAL = Math.SQRT1_2; // 1/sqrt(2)
  // Normalization rounds at the last bits, so components compare
  // approximately.
  const expectDirection = (
    result: { x: number; y: number },
    x: number,
    y: number,
  ): void => {
    expect(result.x).toBeCloseTo(x, 12);
    expect(result.y).toBeCloseTo(y, 12);
    expect(Math.hypot(result.x, result.y)).toBeCloseTo(1, 12);
  };

  it('maps screen up to the world up-left diagonal', () => {
    expectDirection(screenDirectionToWorld(iso, 0, -1), -DIAGONAL, -DIAGONAL);
  });

  it('maps screen down to the world down-right diagonal', () => {
    expectDirection(screenDirectionToWorld(iso, 0, 1), DIAGONAL, DIAGONAL);
  });

  it('maps screen right to world +x/-y and screen left to -x/+y', () => {
    expectDirection(screenDirectionToWorld(iso, 1, 0), DIAGONAL, -DIAGONAL);
    expectDirection(screenDirectionToWorld(iso, -1, 0), -DIAGONAL, DIAGONAL);
  });

  it('moves the same world speed for combined directions', () => {
    // Up+right held together: the world vector projects to the screen
    // up-right diagonal, and stays a unit vector.
    const world = screenDirectionToWorld(iso, 1, -1);
    expect(Math.hypot(world.x, world.y)).toBeCloseTo(1, 10);
    const screen = worldToIsoPlane(iso, world.x * 32, world.y * 32);
    expect(screen.x).toBeGreaterThan(0);
    expect(screen.y).toBeLessThan(0);
  });

  it('returns the zero vector for no input', () => {
    expect(screenDirectionToWorld(iso, 0, 0)).toEqual({ x: 0, y: 0 });
  });
});
