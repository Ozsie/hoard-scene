// The character-clip core shared by every sheet format the package
// supports. Clips are ordered frames of atlas rects with authored
// durations and a loop flag — whether they come from a uniform
// direction-row grid or from a parsed manifest (see
// spriteSheetManifests.ts). This module holds the format-neutral
// model: frame selection, the clip-key/direction conventions and
// pivot anchoring. New sheet formats are added as parsers that map
// into these clip types, never as format branches in this math.

// Where in a sheet the selected frame sits — the source half of a
// drawImage call.
export type SpriteClipSource = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

// The clip key convention of the character sheets: `idle_south`.
export const spriteClipKey = (action: string, direction: string): string =>
  `${action}_${direction}`;

// Row index of a direction within a sheet's row order (a manifest's
// `directions` list, e.g. south, east, north, west). An unknown
// direction reads as the first row.
export const spriteDirectionRow = (
  directions: readonly string[],
  direction: string,
): number => Math.max(directions.indexOf(direction), 0);

// One frame of a clip: its atlas rect and authored duration.
export type SpriteClipFrame = {
  rect: readonly [number, number, number, number];
  durationMs: number;
};

// A clip: optional action/direction metadata (the key's two halves),
// a loop flag (absent or true means looping) and ordered frames with
// explicit rects and durations.
export type SpriteClip = {
  action?: string;
  direction?: string;
  loop?: boolean;
  frames: readonly SpriteClipFrame[];
};

// Where in the sheet the uniform-grid clip's frame at `timeMs` sits.
// Time before the first frame reads as 0; non-looping clips hold
// their last frame. Non-positive cell sides and frame counts clamp to
// one frame, and a non-positive duration freezes the clip on its
// first frame.
export type SpriteGridClip = {
  cellWidth: number;
  cellHeight: number;
  row: number;
  frameCount: number;
  frameDurationMs: number;
  loop?: boolean;
};

export const spriteGridFrameAt = (
  clip: SpriteGridClip,
  timeMs: number,
): SpriteClipSource => {
  const cellWidth = Math.max(1, clip.cellWidth);
  const cellHeight = Math.max(1, clip.cellHeight);
  const frameCount = Math.max(1, Math.floor(clip.frameCount));
  const time = Math.max(0, timeMs);
  const rawFrame =
    clip.frameDurationMs > 0 ? Math.floor(time / clip.frameDurationMs) : 0;
  const frame =
    clip.loop === false
      ? Math.min(rawFrame, frameCount - 1)
      : rawFrame % frameCount;
  return {
    sx: frame * cellWidth,
    sy: Math.max(0, clip.row) * cellHeight,
    sw: cellWidth,
    sh: cellHeight,
  };
};

// Where in the sheet the clip's frame at `timeMs` sits, walking the
// authored durations in order — looping clips wrap at the cycle
// length, non-looping clips hold their last frame, and a clip whose
// durations sum to zero sits on its first frame. Clips without frames
// have no frame at all: undefined.
export const spriteClipFrameAt = (
  clip: SpriteClip,
  timeMs: number,
): SpriteClipSource | undefined => {
  const first = clip.frames[0];
  if (!first) return undefined;
  const rectSource = (frame: SpriteClipFrame): SpriteClipSource => {
    const [sx, sy, sw, sh] = frame.rect;
    return { sx, sy, sw, sh };
  };
  const cycleMs = clip.frames.reduce(
    (sum, frame) => sum + Math.max(0, frame.durationMs),
    0,
  );
  if (cycleMs <= 0) return rectSource(first);
  let time = Math.max(0, timeMs);
  if (clip.loop === false) {
    const last = clip.frames[clip.frames.length - 1] ?? first;
    if (time >= cycleMs) return rectSource(last);
  } else {
    time %= cycleMs;
  }
  let elapsed = 0;
  let index = 0;
  for (const frame of clip.frames) {
    index += 1;
    elapsed += Math.max(0, frame.durationMs);
    if (time < elapsed || index === clip.frames.length) {
      return rectSource(frame);
    }
  }
  return rectSource(first);
};

// The draw origin for a frame: its top-left corner position such that
// the pivot (sheet pixels within the cell) lands on `anchor` at the
// given draw size. Cell sides below one pixel act as one.
export const spriteAnchoredOrigin = (
  anchor: { x: number; y: number },
  pivot: readonly [number, number],
  cell: readonly [number, number],
  drawWidth: number,
  drawHeight: number,
): { x: number; y: number } => ({
  x: anchor.x - (drawWidth * pivot[0]) / Math.max(1, cell[0]),
  y: anchor.y - (drawHeight * pivot[1]) / Math.max(1, cell[1]),
});
