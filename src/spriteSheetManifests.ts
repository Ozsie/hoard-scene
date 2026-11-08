// Parser for the Godot-style character-sheet manifest format — the
// `aligned.json` and `animations/animation.json` files shipped next to
// the character sprite sheets: the atlas image, cell and pivot values,
// the sheet's direction row order, and clips keyed `action_direction`
// with per-frame `rect` and `duration_ms` — clips may carry their own
// cell, pivot and sheet values over the manifest-level ones. The
// manifest parses into the format-neutral clip types from
// spriteClips.ts, so frame selection and pivot anchoring are shared
// with every other sheet format. A new sheet format lands here as a
// sibling parser that maps into the same clip model — never as a
// format branch in the math.
import type { SpriteClip, SpriteClipFrame } from './spriteClips';

// The Godot-style character-sheet manifest: the atlas image, its cell
// and pivot, the sheet's direction row order and its clips keyed by
// `action_direction`. A clip may carry its own cell, pivot and sheet
// values (as the animation manifests do) to override the
// manifest-level ones.
export type SpriteSheetManifest = {
  image?: string;
  cell?: readonly [number, number];
  pivot?: readonly [number, number];
  directions?: readonly string[];
  clips: Readonly<Record<string, SpriteManifestClip>>;
};

// A manifest clip with its format-specific extras: per-clip cell and
// pivot values and the sheet the clip's frames live on (relative to
// the manifest). Values absent from the clip defer to the manifest.
export type SpriteManifestClip = SpriteClip & {
  cell?: readonly [number, number];
  pivot?: readonly [number, number];
  sheet?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finiteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const pairOf = (
  raw: unknown,
  field: string,
): readonly [number, number] | undefined => {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.length !== 2) {
    throw new Error(`sprite-sheet manifest: '${field}' is not a pair`);
  }
  const [x, y] = raw as [unknown, unknown];
  const px = finiteNumber(x);
  const py = finiteNumber(y);
  if (px === undefined || py === undefined) {
    throw new Error(`sprite-sheet manifest: '${field}' is not a pair`);
  }
  return [px, py];
};

const rectOf = (raw: unknown, field: string): SpriteClipFrame['rect'] => {
  if (!Array.isArray(raw) || raw.length !== 4) {
    throw new Error(`sprite-sheet manifest: '${field}' is not a rect`);
  }
  const [x, y, width, height] = raw as [unknown, unknown, unknown, unknown];
  const sx = finiteNumber(x);
  const sy = finiteNumber(y);
  const sw = finiteNumber(width);
  const sh = finiteNumber(height);
  if (
    sx === undefined ||
    sy === undefined ||
    sw === undefined ||
    sh === undefined
  ) {
    throw new Error(`sprite-sheet manifest: '${field}' is not a rect`);
  }
  return [sx, sy, sw, sh];
};

const clipOf = (key: string, raw: unknown): SpriteManifestClip => {
  if (!isRecord(raw)) {
    throw new Error(`sprite-sheet manifest: clip '${key}' is not an object`);
  }
  if (!Array.isArray(raw.frames)) {
    throw new Error(`sprite-sheet manifest: clip '${key}' has no frames array`);
  }
  const durations = Array.isArray(raw.durations_ms) ? raw.durations_ms : [];
  const frames = raw.frames.map((entry, index): SpriteClipFrame => {
    const field = `clips.${key}.frames[${index}]`;
    if (!isRecord(entry)) {
      throw new Error(`sprite-sheet manifest: '${field}' is not an object`);
    }
    return {
      rect: rectOf(entry.rect, `${field}.rect`),
      durationMs:
        finiteNumber(entry.duration_ms) ?? finiteNumber(durations[index]) ?? 0,
    };
  });
  return {
    action: typeof raw.action === 'string' ? raw.action : undefined,
    direction: typeof raw.direction === 'string' ? raw.direction : undefined,
    loop: typeof raw.loop === 'boolean' ? raw.loop : undefined,
    cell: pairOf(raw.cell, `clips.${key}.cell`),
    pivot: pairOf(raw.pivot, `clips.${key}.pivot`),
    sheet: typeof raw.sheet === 'string' ? raw.sheet : undefined,
    frames,
  };
};

// Parses a Godot-style character-sheet manifest. Frame rects must be
// well formed — malformed clip data throws — while unknown fields and
// missing optional values are ignored; a frame without a duration
// falls back to the clip's `durations_ms` entry, then to 0.
export const parseSpriteSheetManifest = (raw: unknown): SpriteSheetManifest => {
  if (!isRecord(raw)) {
    throw new Error('sprite-sheet manifest: expected an object');
  }
  if (!isRecord(raw.clips)) {
    throw new Error('sprite-sheet manifest: missing clips object');
  }
  const clips: Record<string, SpriteClip> = {};
  for (const key of Object.keys(raw.clips)) {
    clips[key] = clipOf(key, raw.clips[key]);
  }
  return {
    image: typeof raw.image === 'string' ? raw.image : undefined,
    cell: pairOf(raw.cell, 'cell'),
    pivot: pairOf(raw.pivot, 'pivot'),
    directions: Array.isArray(raw.directions)
      ? raw.directions.filter(
          (entry): entry is string => typeof entry === 'string',
        )
      : undefined,
    clips,
  };
};
