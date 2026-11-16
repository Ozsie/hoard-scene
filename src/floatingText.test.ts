import { describe, expect, it, vi } from 'vitest';
import { createIsoView } from './isoView';
import { renderIsoFloatingTexts } from './floatingText';

describe('renderIsoFloatingTexts', () => {
  it('draws text at the projected center of its logical cell', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      setTransform: vi.fn(),
      strokeText: vi.fn(),
      fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const view = createIsoView({ x: 0, y: 0 }, 300, 200, 48);

    const hasActive = renderIsoFloatingTexts(
      ctx,
      view,
      48,
      [
        {
          position: { x: 1, y: 2 },
          text: '5',
          effect: 'static',
          timestamp: 1000,
        },
      ],
      1000,
    );

    expect(hasActive).toBe(true);
    expect(ctx.fillText).toHaveBeenCalledWith('5', 102, 196);
    expect(ctx.strokeText).toHaveBeenCalledWith('5', 102, 196);
    expect(ctx.setTransform).not.toHaveBeenCalled();
  });
});
