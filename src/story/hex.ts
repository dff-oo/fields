/** A field-map cell. Even columns sit half a cell south of odd ones (client 0x49bd20). */
export interface Hex {
  x: number;
  y: number;
}

/**
 * Pixel layout from libDelta 0x4ae158, with the cell step stored at 0x4b08d0.
 * Coordinates are the client's design pixels (y grows south). Hex (1, 1) is the origin.
 * Even columns — (x - 1) odd — sit half a row south, as the field draws them on screen.
 */
export const HEX_STEP_X = 126;
export const HEX_STEP_Y = 124;
export const HEX_ORIGIN_X = 254;
export const HEX_ORIGIN_Y = 214;
export const HEX_EVEN_COLUMN_SHIFT = HEX_STEP_Y / 2;

/**
 * The FieldMap painting measured in hexes, from the Chapter 1 field in the client
 * (disp_scale_x 2): the square texture spans 20.83 columns (21.17 rows), and hex (1, 1)'s
 * centre is 2.77 columns from its left edge and 5.39 rows from its top.
 */
export const FIELD_IMAGE_COLUMNS_PER_SCALE = 20.83 / 2;
export const FIELD_IMAGE_FIRST_HEX_COLUMNS = 2.77;
export const FIELD_IMAGE_FIRST_HEX_ROWS = 5.39;

/** Where a field's painting lies in hex pixel space. */
export function fieldImageRect(scaleX: number): { x: number; y: number; width: number; height: number } {
  const side = FIELD_IMAGE_COLUMNS_PER_SCALE * scaleX * HEX_STEP_X;
  return {
    x: HEX_ORIGIN_X - FIELD_IMAGE_FIRST_HEX_COLUMNS * HEX_STEP_X,
    y: HEX_ORIGIN_Y - FIELD_IMAGE_FIRST_HEX_ROWS * HEX_STEP_Y,
    width: side,
    height: side,
  };
}

export function hexPixel(x: number, y: number): { cx: number; cy: number } {
  const column = x - 1;
  const row = y - 1;
  return {
    cx: HEX_STEP_X * column + HEX_ORIGIN_X,
    cy: HEX_STEP_Y * row + HEX_ORIGIN_Y + ((column & 1) !== 0 ? HEX_EVEN_COLUMN_SHIFT : 0),
  };
}

/** The six neighbours, clockwise from north, matching adjacent(). */
function neighbourRing(x: number, y: number): [number, number][] {
  const south = x % 2 === 0 ? 1 : 0;
  const north = x % 2 === 0 ? 0 : -1;
  return [
    [x, y - 1],
    [x + 1, y + north],
    [x + 1, y + south],
    [x, y + 1],
    [x - 1, y + south],
    [x - 1, y + north],
  ];
}

/** Cell outline whose corners are shared with the neighbouring cells. */
export function hexOutline(x: number, y: number): string {
  const here = hexPixel(x, y);
  const ring = neighbourRing(x, y);
  return ring
    .map((neighbour, index) => {
      const next = ring[(index + 1) % ring.length];
      const a = hexPixel(neighbour[0], neighbour[1]);
      const b = hexPixel(next[0], next[1]);
      return `${(here.cx + a.cx + b.cx) / 3},${(here.cy + a.cy + b.cy) / 3}`;
    })
    .join(' ');
}

export function adjacent(a: Hex, b: Hex): boolean {
  if (a.x === b.x) return Math.abs(a.y - b.y) === 1;
  if (Math.abs(a.x - b.x) !== 1) return false;
  return (
    b.y === a.y ||
    (b.y === a.y - 1 && b.x % 2 === 0) ||
    (b.y === a.y + 1 && b.x % 2 === 1)
  );
}

/** Quest ids in `sites` that cannot be reached from `startId` by walking adjacent hexes. */
export function stranded(sites: readonly (Hex & { id: number })[], startId: number): number[] {
  const reached = new Set<number>([startId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const site of sites) {
      if (reached.has(site.id)) continue;
      if (sites.some((other) => reached.has(other.id) && adjacent(other, site))) {
        reached.add(site.id);
        grew = true;
      }
    }
  }
  return sites.filter((site) => !reached.has(site.id)).map((site) => site.id);
}
