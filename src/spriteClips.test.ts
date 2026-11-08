import { describe, expect, it } from 'vitest';
import {
  spriteAnchoredOrigin,
  spriteClipFrameAt,
  spriteClipKey,
  spriteDirectionRow,
  spriteGridFrameAt,
  spriteGridFrameIndex,
} from './spriteClips';

const sheetDirections = ['south', 'east', 'north', 'west'];

describe('spriteClipKey', () => {
  it('joins the action and direction the manifest clip keys use', () => {
    expect(spriteClipKey('idle', 'south')).toBe('idle_south');
    expect(spriteClipKey('walk', 'north-west')).toBe('walk_north-west');
  });
});

describe('spriteDirectionRow', () => {
  it('finds each direction row in the sheet row order', () => {
    expect(spriteDirectionRow(sheetDirections, 'south')).toBe(0);
    expect(spriteDirectionRow(sheetDirections, 'east')).toBe(1);
    expect(spriteDirectionRow(sheetDirections, 'north')).toBe(2);
    expect(spriteDirectionRow(sheetDirections, 'west')).toBe(3);
  });

  it('falls back to the first row for unknown directions', () => {
    expect(spriteDirectionRow(sheetDirections, 'up')).toBe(0);
    expect(spriteDirectionRow([], 'south')).toBe(0);
  });
});

describe('spriteGridFrameAt', () => {
  it('walks the clip frames at the authored pace', () => {
    const clip = {
      cellWidth: 64,
      cellHeight: 64,
      row: 1,
      frameCount: 9,
      frameDurationMs: 300,
    };
    expect(spriteGridFrameAt(clip, 0)).toEqual({
      sx: 0,
      sy: 64,
      sw: 64,
      sh: 64,
    });
    expect(spriteGridFrameAt(clip, 600)).toEqual({
      sx: 128,
      sy: 64,
      sw: 64,
      sh: 64,
    });
  });

  it('loops past the clip and honors custom cell sizes', () => {
    expect(
      spriteGridFrameAt(
        {
          cellWidth: 80,
          cellHeight: 80,
          row: 3,
          frameCount: 8,
          frameDurationMs: 100,
        },
        800,
      ),
    ).toEqual({ sx: 0, sy: 240, sw: 80, sh: 80 });
    expect(
      spriteGridFrameAt(
        {
          cellWidth: 48,
          cellHeight: 56,
          row: 2,
          frameCount: 4,
          frameDurationMs: 100,
        },
        250,
      ),
    ).toEqual({ sx: 96, sy: 112, sw: 48, sh: 56 });
  });

  it('holds the last frame when the clip does not loop', () => {
    const clip = {
      cellWidth: 64,
      cellHeight: 64,
      row: 0,
      frameCount: 8,
      frameDurationMs: 100,
      loop: false,
    };
    expect(spriteGridFrameAt(clip, 700).sx).toBe(448);
    expect(spriteGridFrameAt(clip, 10000).sx).toBe(448);
  });

  it('degrades gracefully on degenerate clip data', () => {
    const clip = {
      cellWidth: 64,
      cellHeight: 64,
      row: 0,
      frameCount: 0,
      frameDurationMs: 0,
    };
    expect(spriteGridFrameAt(clip, 12345)).toEqual({
      sx: 0,
      sy: 0,
      sw: 64,
      sh: 64,
    });
    expect(spriteGridFrameAt(clip, -100).sx).toBe(0);
  });
});

describe('spriteGridFrameIndex', () => {
  it('wraps looping clips at their frame count', () => {
    const timing = { frameCount: 8, frameDurationMs: 100 };
    expect(spriteGridFrameIndex(timing, 0)).toBe(0);
    expect(spriteGridFrameIndex(timing, 750)).toBe(7);
    expect(spriteGridFrameIndex(timing, 800)).toBe(0);
    expect(spriteGridFrameIndex(timing, -100)).toBe(0);
  });

  it('holds the last frame of non-looping clips', () => {
    const timing = { frameCount: 4, frameDurationMs: 540, loop: false };
    expect(spriteGridFrameIndex(timing, 0)).toBe(0);
    expect(spriteGridFrameIndex(timing, 540)).toBe(1);
    expect(spriteGridFrameIndex(timing, 10_000)).toBe(3);
  });

  it('agrees with spriteGridFrameAt from the same timing', () => {
    const clip = {
      cellWidth: 128,
      cellHeight: 128,
      row: 5,
      frameCount: 15,
      frameDurationMs: 40,
      loop: false as const,
    };
    for (const timeMs of [0, 39, 40, 599, 600, 10_000]) {
      expect(spriteGridFrameIndex(clip, timeMs) * clip.cellWidth).toBe(
        spriteGridFrameAt(clip, timeMs).sx,
      );
    }
  });

  it('clamps degenerate timing to the first frame', () => {
    expect(
      spriteGridFrameIndex({ frameCount: 0, frameDurationMs: 0 }, 99),
    ).toBe(0);
    expect(
      spriteGridFrameIndex({ frameCount: -3, frameDurationMs: -5 }, -99),
    ).toBe(0);
  });
});

const clipWithDurations = (durations: number[], loop?: boolean) => ({
  loop,
  frames: durations.map((durationMs, index) => ({
    rect: [index * 64, 0, 64, 64] as const,
    durationMs,
  })),
});

describe('spriteClipFrameAt', () => {
  it('advances through frames with uneven durations', () => {
    const clip = clipWithDurations([100, 300, 200]);
    expect(spriteClipFrameAt(clip, 0)?.sx).toBe(0);
    expect(spriteClipFrameAt(clip, 99)?.sx).toBe(0);
    expect(spriteClipFrameAt(clip, 100)?.sx).toBe(64);
    expect(spriteClipFrameAt(clip, 399)?.sx).toBe(64);
    expect(spriteClipFrameAt(clip, 400)?.sx).toBe(128);
  });

  it('wraps looping clips and holds the last frame otherwise', () => {
    const looping = clipWithDurations([100, 300, 200]);
    expect(spriteClipFrameAt(looping, 650)?.sx).toBe(0);
    expect(
      spriteClipFrameAt(clipWithDurations([100, 300, 200], false), 650)?.sx,
    ).toBe(128);
  });

  it('returns undefined for empty clips and holds the first frame without durations', () => {
    expect(spriteClipFrameAt({ frames: [] }, 100)).toBeUndefined();
    expect(spriteClipFrameAt(clipWithDurations([0, 0]), 1000)?.sx).toBe(0);
    expect(spriteClipFrameAt(clipWithDurations([200]), -50)?.sx).toBe(0);
  });
});

describe('spriteAnchoredOrigin', () => {
  it('places the pivot point of the drawn cell on the anchor', () => {
    expect(
      spriteAnchoredOrigin({ x: 100, y: 200 }, [32, 54], [64, 64], 192, 192),
    ).toEqual({ x: 4, y: 38 });
  });

  it('scales non-square cells independently', () => {
    expect(
      spriteAnchoredOrigin({ x: 50, y: 60 }, [24, 46], [48, 56], 96, 112),
    ).toEqual({ x: 2, y: -32 });
  });
});
