import { describe, expect, it } from 'vitest';
import { parseSpriteSheetManifest } from './spriteSheetManifests';

describe('parseSpriteSheetManifest', () => {
  it('parses the Godot-style manifest fields and tolerates extras', () => {
    const manifest = parseSpriteSheetManifest({
      name: 'Pro Barista',
      version: '0.1.0',
      character_id: '9a260a6d',
      image: 'art/characters/barista/aligned.png',
      cell: [64, 64],
      pivot: [32, 54],
      directions: ['south', 'east', 'north', 'west'],
      clips: {
        idle_south: {
          action: 'idle',
          direction: 'south',
          model: 'PixelLab',
          loop: true,
          cycle_ms: 900,
          durations_ms: [300, 300, 300],
          frames: [
            { rect: [0, 0, 64, 64], duration_ms: 300 },
            { rect: [64, 0, 64, 64] },
            { rect: [128, 0, 64, 64], duration_ms: 300 },
          ],
        },
        bow_west: {
          action: 'bow',
          direction: 'west',
          loop: false,
          frames: [{ rect: [0, 256, 64, 64], duration_ms: 500 }],
        },
      },
    });
    expect(manifest.image).toBe('art/characters/barista/aligned.png');
    expect(manifest.cell).toEqual([64, 64]);
    expect(manifest.pivot).toEqual([32, 54]);
    expect(manifest.directions).toEqual(['south', 'east', 'north', 'west']);
    const idleSouth = manifest.clips['idle_south'];
    expect(idleSouth?.action).toBe('idle');
    expect(idleSouth?.direction).toBe('south');
    expect(idleSouth?.loop).toBe(true);
    expect(idleSouth?.frames[1]?.rect).toEqual([64, 0, 64, 64]);
    expect(idleSouth?.frames[1]?.durationMs).toBe(300);
    const bowWest = manifest.clips['bow_west'];
    expect(bowWest?.loop).toBe(false);
  });

  it('keeps unknown action and direction metadata optional', () => {
    const manifest = parseSpriteSheetManifest({
      clips: { walk_north: { frames: [{ rect: [0, 0, 64, 64] }] } },
    });
    const clip = manifest.clips['walk_north'];
    expect(clip?.action).toBeUndefined();
    expect(clip?.direction).toBeUndefined();
    expect(clip?.loop).toBeUndefined();
    expect(clip?.frames[0]?.durationMs).toBe(0);
  });

  it('throws on malformed manifests', () => {
    expect(() => parseSpriteSheetManifest(null)).toThrow();
    expect(() => parseSpriteSheetManifest({})).toThrow();
    expect(() =>
      parseSpriteSheetManifest({ clips: { a: { frames: {} } } }),
    ).toThrow();
    expect(() =>
      parseSpriteSheetManifest({
        clips: { a: { frames: [{ rect: [0, 0] }] } },
      }),
    ).toThrow();
    expect(() => parseSpriteSheetManifest({ clips: { a: null } })).toThrow();
    expect(() => parseSpriteSheetManifest({ cell: [64], clips: {} })).toThrow();
  });
});
