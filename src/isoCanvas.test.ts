import { describe, expect, it } from 'vitest';
import {
  drawIsoHeroOverlay,
  drawIsoWorldFrame,
  type SceneIsoPainterView,
  type SceneIsoWorldView,
} from './isoCanvas';
import type { SceneHeroOverlayView } from './contracts';
import { createIsoProjection } from './isoProjection';
import { createIsoView } from './isoView';

describe('drawIsoWorldFrame', () => {
  it('uses terrain colours, floor overlays, and pit fills', () => {
    const fills: string[] = [];
    let currentFillStyle = '';
    const ctx = {
      get fillStyle() {
        return currentFillStyle;
      },
      set fillStyle(value: string) {
        currentFillStyle = value;
      },
      globalAlpha: 1,
      fillRect: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      closePath: () => undefined,
      fill: () => fills.push(currentFillStyle),
      save: () => undefined,
      restore: () => undefined,
    } as unknown as CanvasRenderingContext2D;
    const world: SceneIsoWorldView = {
      rows: ['FF'],
      cellSize: 32,
      wallCell: 'W',
      doorCell: 'D',
      floorColors: [['#224466', undefined]],
      floorOverlays: [[{ color: '#ffffff', opacity: 0.25 }, undefined]],
      pitCells: [{ x: 1, y: 0 }],
      wallHeightPx: 24,
      palette: {
        background: '#000',
        floor: '#111',
        door: '#222',
        wallTop: '#333',
        wallSouth: '#444',
        wallEast: '#555',
        pit: '#080808',
      },
    };
    const view = createIsoView(
      { x: 16, y: 16 },
      100,
      100,
      32,
      createIsoProjection(32),
    );

    drawIsoWorldFrame(ctx, world, view, []);

    expect(fills).toEqual(['#224466', '#ffffff', '#080808']);
  });

  it('draws recessed pit faces without a shared wall between adjacent cells', () => {
    const drawnFaces: string[] = [];
    const ctx = {
      fillStyle: '',
      globalAlpha: 1,
      fillRect: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      closePath: () => undefined,
      fill: () => undefined,
      save: () => undefined,
      restore: () => undefined,
      clip: () => undefined,
    } as unknown as CanvasRenderingContext2D;
    const painter = (
      x: number,
    ): NonNullable<
      NonNullable<SceneIsoWorldView['pitPainters']>[number]
    >[number] => ({
      drawFace: (_context, face) =>
        drawnFaces.push(`${String(x)}:${face.edge}`),
    });
    const world: SceneIsoWorldView = {
      rows: ['FFF'],
      cellSize: 32,
      wallCell: 'W',
      doorCell: 'D',
      pitCells: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      pitDepthPx: 12,
      pitPainters: [[undefined, painter(1), painter(2)]],
      wallHeightPx: 24,
      palette: {
        background: '#000',
        floor: '#111',
        door: '#222',
        wallTop: '#333',
        wallSouth: '#444',
        wallEast: '#555',
        pit: '#080808',
      },
    };
    const view = createIsoView({ x: 48, y: 16 }, 200, 100, 32);

    drawIsoWorldFrame(ctx, world, view, []);

    expect(drawnFaces).toEqual(['1:north', '1:west', '2:north']);
  });

  it('draws recessed pits below the depth-sorted standing walls', () => {
    const draws: string[] = [];
    const ctx = {
      fillStyle: '',
      globalAlpha: 1,
      fillRect: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      closePath: () => undefined,
      fill: () => undefined,
      save: () => undefined,
      restore: () => undefined,
      clip: () => undefined,
    } as unknown as CanvasRenderingContext2D;
    const world: SceneIsoWorldView = {
      rows: ['FW'],
      cellSize: 32,
      wallCell: 'W',
      doorCell: 'D',
      pitCells: [{ x: 0, y: 0 }],
      pitDepthPx: 12,
      pitPainters: [
        [{ drawFace: (_context, face) => draws.push(`pit:${face.edge}`) }],
      ],
      wallPainters: [
        [
          undefined,
          {
            position: { x: 48, y: 16 },
            draw: () => draws.push('wall'),
          },
        ],
      ],
      wallHeightPx: 24,
      palette: {
        background: '#000',
        floor: '#111',
        door: '#222',
        wallTop: '#333',
        wallSouth: '#444',
        wallEast: '#555',
        pit: '#080808',
      },
    };
    const view = createIsoView({ x: 48, y: 16 }, 200, 100, 32);

    drawIsoWorldFrame(ctx, world, view, []);

    expect(draws.slice(0, 2)).toEqual(['pit:north', 'pit:west']);
    expect(draws.at(-1)).toBe('wall');
  });

  it('does not draw cells marked as hidden', () => {
    let floorDraws = 0;
    const ctx = {
      fillStyle: '',
      globalAlpha: 1,
      fillRect: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      closePath: () => undefined,
      fill: () => floorDraws++,
      save: () => undefined,
      restore: () => undefined,
    } as unknown as CanvasRenderingContext2D;
    const world: SceneIsoWorldView = {
      rows: ['FH'],
      cellSize: 32,
      wallCell: 'W',
      doorCell: 'D',
      hiddenCell: 'H',
      wallHeightPx: 24,
      palette: {
        background: '#000',
        floor: '#111',
        door: '#222',
        wallTop: '#333',
        wallSouth: '#444',
        wallEast: '#555',
      },
    };
    const view = createIsoView(
      { x: 16, y: 16 },
      100,
      100,
      32,
      createIsoProjection(32),
    );

    drawIsoWorldFrame(ctx, world, view, []);

    expect(floorDraws).toBe(1);
  });

  it('draws image-backed floors before the depth-sorted wall painter', () => {
    const draws: string[] = [];
    const ctx = {
      fillStyle: '',
      globalAlpha: 1,
      fillRect: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      closePath: () => undefined,
      fill: () => undefined,
      save: () => undefined,
      restore: () => undefined,
    } as unknown as CanvasRenderingContext2D;
    const world: SceneIsoWorldView = {
      rows: ['FW'],
      cellSize: 32,
      wallCell: 'W',
      doorCell: 'D',
      floorPainters: [
        [
          {
            position: { x: 16, y: 16 },
            draw: () => draws.push('floor'),
          },
          undefined,
        ],
      ],
      wallPainters: [
        [
          undefined,
          {
            position: { x: 48, y: 16 },
            draw: () => draws.push('wall'),
          },
        ],
      ],
      wallHeightPx: 24,
      palette: {
        background: '#000',
        floor: '#111',
        door: '#222',
        wallTop: '#333',
        wallSouth: '#444',
        wallEast: '#555',
      },
    };
    const view = createIsoView({ x: 16, y: 16 }, 100, 100, 32);

    drawIsoWorldFrame(ctx, world, view, []);

    expect(draws).toEqual(['floor', 'wall']);
  });

  it('depth-sorts image-backed doors with the wall and actor queue', () => {
    const draws: string[] = [];
    const ctx = {
      fillStyle: '',
      globalAlpha: 1,
      fillRect: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      closePath: () => undefined,
      fill: () => undefined,
      save: () => undefined,
      restore: () => undefined,
    } as unknown as CanvasRenderingContext2D;
    const world: SceneIsoWorldView = {
      rows: ['D'],
      cellSize: 32,
      wallCell: 'W',
      doorCell: 'D',
      floorPainters: [
        [
          {
            position: { x: 16, y: 16 },
            draw: () => draws.push('floor'),
          },
        ],
      ],
      doorPainters: [
        [
          {
            position: { x: 16, y: 16 },
            draw: () => draws.push('door'),
          },
        ],
      ],
      wallHeightPx: 24,
      palette: {
        background: '#000',
        floor: '#111',
        door: '#222',
        wallTop: '#333',
        wallSouth: '#444',
        wallEast: '#555',
      },
    };
    const view = createIsoView({ x: 16, y: 16 }, 100, 100, 32);

    drawIsoWorldFrame(ctx, world, view, []);

    expect(draws).toEqual(['floor', 'door']);
  });

  it('depth-sorts game-provided painters with wall prisms', () => {
    const draws: string[] = [];
    const ctx = {
      fillRect: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      closePath: () => undefined,
      fill: () => draws.push('wall'),
    } as unknown as CanvasRenderingContext2D;
    const world: SceneIsoWorldView = {
      rows: ['W'],
      cellSize: 32,
      wallCell: 'W',
      doorCell: 'D',
      wallHeightPx: 24,
      palette: {
        background: '#000',
        floor: '#111',
        door: '#222',
        wallTop: '#333',
        wallSouth: '#444',
        wallEast: '#555',
      },
    };
    const view = createIsoView(
      { x: 16, y: 16 },
      100,
      100,
      32,
      createIsoProjection(32),
    );
    const painters: SceneIsoPainterView[] = [
      {
        position: { x: 16, y: 20 },
        draw: () => draws.push('behind'),
      },
      {
        position: { x: 16, y: 12 },
        draw: () => draws.push('in-front'),
      },
    ];

    drawIsoWorldFrame(ctx, world, view, [], painters);

    expect(draws).toEqual(['in-front', 'wall', 'wall', 'wall', 'behind']);
  });
});

describe('drawIsoHeroOverlay', () => {
  it('projects walkable cells, turn markers, health bars and pips', () => {
    let strokes = 0;
    let fills = 0;
    const ctx = {
      save: () => undefined,
      restore: () => undefined,
      beginPath: () => undefined,
      closePath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      stroke: () => strokes++,
      fillRect: () => fills++,
      lineWidth: 1,
      strokeStyle: '',
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D;
    const overlay: SceneHeroOverlayView = {
      walkableCells: [{ x: 0, y: 0 }],
      marker: { x: 1, y: 0 },
      bars: [
        {
          position: { x: 2, y: 0 },
          colour: '#f0f',
          health: { current: 4, max: 8 },
          actionPips: 1,
          movePips: 1,
        },
      ],
    };
    const view = createIsoView(
      { x: 16, y: 16 },
      100,
      100,
      32,
      createIsoProjection(32),
    );

    drawIsoHeroOverlay(ctx, view, overlay, 32);

    expect(strokes).toBe(2);
    expect(fills).toBe(5);
  });
});
