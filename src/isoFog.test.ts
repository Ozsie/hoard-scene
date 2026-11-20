import { describe, expect, it, vi } from 'vitest';
import { createIsoProjection } from './isoProjection';
import { createIsoView } from './isoView';
import { drawIsoFogLightDim } from './isoFog';
import type { SceneDungeonView } from './dungeonView';

const dungeonWithFog: SceneDungeonView = {
  name: 'fog-test',
  discoveredRooms: ['A'],
  layout: {
    grid: ['AAB'],
    roomFog: {
      A: { density: 0.6, softness: 0 },
      B: { density: 0.9, softness: 0 },
    },
    doors: [],
    secrets: [],
  },
};

const makeContext = () =>
  ({
    beginPath: vi.fn(),
    drawImage: vi.fn(),
    fill: vi.fn(),
    rect: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    setTransform: vi.fn(),
  }) as unknown as CanvasRenderingContext2D;

describe('drawIsoFogLightDim', () => {
  it('applies the view projection, camera, zoom and device pixel ratio', () => {
    const ctx = makeContext();
    const zoom = 1.5;
    const projection = createIsoProjection(48, 96 * zoom, 48 * zoom);
    const view = createIsoView({ x: 48, y: 96 }, 400, 300, 48, projection);

    drawIsoFogLightDim(ctx, 48, dungeonWithFog, view, 2);

    expect(ctx.setTransform).toHaveBeenCalledWith(3, 1.5, -3, 1.5, 544, 84);
  });

  it('does not touch the context for a non-positive pixel ratio', () => {
    const ctx = makeContext();
    const view = createIsoView({ x: 0, y: 0 }, 400, 300, 48);

    drawIsoFogLightDim(ctx, 48, dungeonWithFog, view, 0);

    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.setTransform).not.toHaveBeenCalled();
    expect(ctx.restore).not.toHaveBeenCalled();
  });

  it('dims discovered fog without drawing fog from undiscovered rooms', () => {
    const ctx = makeContext();
    const view = createIsoView({ x: 0, y: 0 }, 400, 300, 48);

    drawIsoFogLightDim(ctx, 48, dungeonWithFog, view, 1);

    expect(ctx.rect).toHaveBeenCalledTimes(2);
    expect(ctx.rect).toHaveBeenNthCalledWith(1, 0, 0, 48, 48);
    expect(ctx.rect).toHaveBeenNthCalledWith(2, 48, 0, 48, 48);
    expect(ctx.fill).toHaveBeenCalledOnce();
  });

  it('does not draw when the dungeon has no fog', () => {
    const ctx = makeContext();
    const dungeon: SceneDungeonView = {
      ...dungeonWithFog,
      layout: { ...dungeonWithFog.layout, roomFog: undefined },
    };
    const view = createIsoView({ x: 0, y: 0 }, 400, 300, 48);

    drawIsoFogLightDim(ctx, 48, dungeon, view, 1);

    expect(ctx.rect).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });
});
