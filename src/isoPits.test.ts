import { describe, expect, it } from 'vitest';
import {
  drawIsoPitCell,
  drawIsoPitCells,
  getIsoPitFaces,
  type SceneIsoPitFaceView,
} from './isoPits';
import { createIsoProjection } from './isoProjection';
import { createIsoView } from './isoView';

const view = createIsoView(
  { x: 48, y: 48 },
  200,
  200,
  32,
  createIsoProjection(32),
);

describe('isometric recessed pits', () => {
  it('draws only exposed north and west faces around connected pit cells', () => {
    const pitCells = new Set(['1,1', '2,1']);
    const hasPit = (x: number, y: number): boolean =>
      pitCells.has(`${String(x)},${String(y)}`);

    const first = getIsoPitFaces(view, 32, 1, 1, 12, hasPit);
    const second = getIsoPitFaces(view, 32, 2, 1, 12, hasPit);

    expect(first.map(({ edge }) => edge)).toEqual(['north', 'west']);
    expect(second.map(({ edge }) => edge)).toEqual(['north']);
  });

  it('omits shared faces in an irregular L-shaped pit', () => {
    const pitCells = new Set(['1,1', '2,1', '1,2']);
    const hasPit = (x: number, y: number): boolean =>
      pitCells.has(`${String(x)},${String(y)}`);
    const edges = [
      ...getIsoPitFaces(view, 32, 1, 1, 12, hasPit).map(
        ({ edge }) => `1,1:${edge}`,
      ),
      ...getIsoPitFaces(view, 32, 2, 1, 12, hasPit).map(
        ({ edge }) => `2,1:${edge}`,
      ),
      ...getIsoPitFaces(view, 32, 1, 2, 12, hasPit).map(
        ({ edge }) => `1,2:${edge}`,
      ),
    ];

    expect(edges).toEqual(['1,1:north', '1,1:west', '2,1:north', '1,2:west']);
  });

  it('clips connected pits as one opening and keeps detached pits separate', () => {
    const clippedPaths: Array<Array<{ x: number; y: number }>> = [];
    const drawnFaces: SceneIsoPitFaceView[] = [];
    let path: Array<{ x: number; y: number }> = [];
    let currentFillStyle = '';
    const ctx = {
      get fillStyle() {
        return currentFillStyle;
      },
      set fillStyle(value: string) {
        currentFillStyle = value;
      },
      beginPath: () => (path = []),
      moveTo: (x: number, y: number) => path.push({ x, y }),
      lineTo: (x: number, y: number) => path.push({ x, y }),
      closePath: () => undefined,
      fill: () => undefined,
      save: () => undefined,
      restore: () => undefined,
      clip: () => clippedPaths.push([...path]),
    } as unknown as CanvasRenderingContext2D;
    const painter = {
      drawFace: (
        _context: CanvasRenderingContext2D,
        face: SceneIsoPitFaceView,
      ) => drawnFaces.push(face),
    };

    drawIsoPitCells(ctx, view, {
      cellSize: 32,
      cells: [
        { x: 1, y: 1, painter },
        { x: 2, y: 1, painter },
        { x: 4, y: 1, painter },
      ],
      depthPx: 12,
      bottomColor: '#080808',
      northWallColor: '#34312d',
      westWallColor: '#272522',
    });

    expect(clippedPaths).toHaveLength(7);
    expect(clippedPaths[0]).toHaveLength(8);
    expect(clippedPaths[1]).toHaveLength(4);
    expect(drawnFaces.map(({ edge }) => edge)).toEqual([
      'north',
      'west',
      'north',
      'north',
      'west',
    ]);
    expect(clippedPaths.slice(1, 4)).toEqual(
      drawnFaces.slice(0, 3).map(({ points }) => points),
    );
    expect(clippedPaths[4]).toHaveLength(4);
    expect(clippedPaths.slice(5)).toEqual(
      drawnFaces.slice(3).map(({ points }) => points),
    );
  });

  it('scales the lowered wall geometry with the isometric projection', () => {
    const shallowView = createIsoView(
      { x: 48, y: 48 },
      200,
      200,
      32,
      createIsoProjection(32, 64, 16),
    );
    const faces = getIsoPitFaces(shallowView, 32, 1, 1, 12, () => false);
    const north = faces.find(({ edge }) => edge === 'north');

    expect(north).toBeDefined();
    if (!north) return;
    expect(north.points[2].y - north.points[1].y).toBe(3);
  });

  it('clips textured faces to the opening and retains shaded fallback faces', () => {
    const fills: string[] = [];
    const drawnFaces: SceneIsoPitFaceView[] = [];
    let clips = 0;
    let currentFillStyle = '';
    const ctx = {
      get fillStyle() {
        return currentFillStyle;
      },
      set fillStyle(value: string) {
        currentFillStyle = value;
      },
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      closePath: () => undefined,
      fill: () => fills.push(currentFillStyle),
      save: () => undefined,
      restore: () => undefined,
      clip: () => clips++,
    } as unknown as CanvasRenderingContext2D;

    drawIsoPitCell(ctx, view, {
      cellSize: 32,
      x: 1,
      y: 1,
      depthPx: 12,
      bottomColor: '#080808',
      northWallColor: '#34312d',
      westWallColor: '#272522',
      hasPit: () => false,
      painter: {
        drawFace: (_context, face) => drawnFaces.push(face),
      },
    });

    expect(fills).toEqual(['#080808', '#34312d', '#272522']);
    expect(drawnFaces.map(({ edge }) => edge)).toEqual(['north', 'west']);
    expect(clips).toBe(3);

    drawIsoPitCell(ctx, view, {
      cellSize: 32,
      x: 1,
      y: 1,
      depthPx: 12,
      bottomColor: '#080808',
      northWallColor: '#34312d',
      westWallColor: '#272522',
      hasPit: () => false,
    });

    expect(fills).toEqual([
      '#080808',
      '#34312d',
      '#272522',
      '#080808',
      '#34312d',
      '#272522',
    ]);
    expect(clips).toBe(4);
  });
});
