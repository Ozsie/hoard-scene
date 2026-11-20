import { describe, expect, it } from 'vitest';
import { isoTileDimensions } from './isoTiles';

describe('isoTileDimensions', () => {
  it('sizes an asset from the projected cell width and natural aspect ratio', () => {
    expect(isoTileDimensions(48, { ax: 1.5 }, 2, 128, 64)).toEqual({
      width: 288,
      height: 144,
    });
  });

  it('applies the natural height-to-width ratio without changing width', () => {
    expect(isoTileDimensions(32, { ax: 1 }, 0.5, 64, 96)).toEqual({
      width: 32,
      height: 48,
    });
  });
});
