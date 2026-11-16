import { describe, expect, it, vi } from 'vitest';
import { renderHeroOverlay } from './actorCanvas';
import type { SceneHeroOverlayView } from './contracts';

describe('renderHeroOverlay', () => {
  it('uses the supplied walkable-cell color', () => {
    const ctx = {
      strokeStyle: '',
      lineWidth: 0,
      strokeRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const view = {
      walkableCells: [{ x: 1, y: 2 }],
      walkableCellColor: 'lightblue',
      marker: null,
      bars: [],
    } as SceneHeroOverlayView & { walkableCellColor: string };

    renderHeroOverlay(ctx, view, 32);

    expect(ctx.strokeStyle).toBe('lightblue');
    expect(ctx.strokeRect).toHaveBeenCalledWith(32, 64, 32, 32);
  });
});
