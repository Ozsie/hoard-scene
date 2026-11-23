import { describe, expect, it, vi } from 'vitest';
import { renderSceneLights } from './lightsCanvas';
import type { SceneLightView } from './lightsView';

// A no-op 2D context capturing the gradient stops a light fill produces.
const createMockCtx = () => {
  const stops: [number, string][] = [];
  const gradient = {
    addColorStop: vi.fn((offset: number, color: string) => {
      stops.push([offset, color]);
    }),
  };
  const ctx = {
    createRadialGradient: vi.fn().mockReturnValue(gradient),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    filter: 'none',
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D;
  return { ctx, stops, gradient };
};

const lightView = (
  overrides: Partial<SceneLightView> = {},
): SceneLightView => ({
  center: { x: 24, y: 24 },
  color: '#FFB85C',
  intensity: 0.5,
  radius: 96,
  intensityScale: 1,
  blurPx: 0,
  effect: 'static',
  polygon: [
    { x: 24, y: -72 },
    { x: 120, y: 24 },
    { x: 24, y: 120 },
    { x: -72, y: 24 },
  ],
  sparkles: [],
  bakeable: false,
  spriteIdentity: 'test',
  occlusionKey: 'test',
  ...overrides,
});

describe('renderSceneLights gradient falloff', () => {
  it('maps resolved falloff samples onto the gradient stops', () => {
    const { ctx, stops } = createMockCtx();
    renderSceneLights(ctx, 48, [lightView({ falloff: [1, 0.5, 0] })], false);
    // Peak alpha: intensity 0.5 * 1.5 * intensityScale 1 = 0.75.
    expect(stops).toEqual([
      [0, 'rgba(255, 184, 92, 0.75)'],
      [0.5, 'rgba(255, 184, 92, 0.375)'],
      [1, 'rgba(255, 184, 92, 0)'],
    ]);
  });

  it('keeps the legacy nine-stop quadratic without falloff samples', () => {
    const { ctx, stops } = createMockCtx();
    renderSceneLights(ctx, 48, [lightView()], false);
    expect(stops.length).toBe(9);
    expect(stops[0][0]).toBe(0);
    expect(stops[stops.length - 1][0]).toBe(1);
    stops.forEach(([t, color], i) => {
      const alpha = 0.75 * Math.pow(1 - t, 2);
      const parsed = color.match(/^rgba\(255, 184, 92, ([\d.]+)\)$/);
      expect(parsed).not.toBeNull();
      expect(Number(parsed![1])).toBeCloseTo(alpha, 10);
      expect(t).toBeCloseTo(i / 8, 10);
    });
  });

  it('handles three-digit hex and rgb() colors without six-digit-hex assumptions', () => {
    const shortHex = createMockCtx();
    renderSceneLights(
      shortHex.ctx,
      48,
      [lightView({ color: '#abc', falloff: [1, 0] })],
      false,
    );
    expect(shortHex.stops[0][1]).toBe('rgba(170, 187, 204, 0.75)');

    const functional = createMockCtx();
    renderSceneLights(
      functional.ctx,
      48,
      [lightView({ color: 'rgb(255, 184, 92)', falloff: [1, 0] })],
      false,
    );
    expect(functional.stops[0][1]).toBe('rgba(255, 184, 92, 0.75)');
  });
});
