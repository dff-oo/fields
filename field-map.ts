import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
const PACKAGE_NAME = 'com.square_enix.android_googleplay.DFFOperaOmnian';

const MODIFIERS = [
  [2, 8, -2, -8],
  [5, 17, -5, -17],
  [9, 29, -9, -29],
  [13, 42, -13, -42],
  [18, 60, -18, -60],
  [24, 80, -24, -80],
  [33, 106, -33, -106],
  [47, 183, -47, -183],
];

function clampByte(value: number): number {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return value;
}

/** ETC1 RGB, the format FieldMap textures use (g1t format 0x6F). */
export function decodeEtc1(src: Buffer, width: number, height: number): Buffer {
  const out = Buffer.alloc(width * height * 4);
  const columns = width >> 2;
  const rows = height >> 2;
  let offset = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const word0 = src.readUInt32BE(offset);
      const word1 = src.readUInt32BE(offset + 4);
      offset += 8;
      const differential = (word0 >> 1) & 1;
      const flip = word0 & 1;
      const table0 = (word0 >> 5) & 7;
      const table1 = (word0 >> 2) & 7;
      let r0: number;
      let g0: number;
      let b0: number;
      let r1: number;
      let g1: number;
      let b1: number;
      if (differential) {
        const extend = (value: number) => (value << 3) | (value >> 2);
        const delta = (value: number) => (value >= 4 ? value - 8 : value);
        const red = (word0 >> 27) & 31;
        const green = (word0 >> 19) & 31;
        const blue = (word0 >> 11) & 31;
        r0 = extend(red);
        g0 = extend(green);
        b0 = extend(blue);
        r1 = extend((red + delta((word0 >> 24) & 7)) & 31);
        g1 = extend((green + delta((word0 >> 16) & 7)) & 31);
        b1 = extend((blue + delta((word0 >> 8) & 7)) & 31);
      } else {
        const nibble = (value: number) => (value << 4) | value;
        r0 = nibble((word0 >> 28) & 15);
        g0 = nibble((word0 >> 20) & 15);
        b0 = nibble((word0 >> 12) & 15);
        r1 = nibble((word0 >> 24) & 15);
        g1 = nibble((word0 >> 16) & 15);
        b1 = nibble((word0 >> 8) & 15);
      }
      for (let py = 0; py < 4; py += 1) {
        for (let px = 0; px < 4; px += 1) {
          const index = px * 4 + py;
          const modifier = (((word1 >> (index + 16)) & 1) << 1) | ((word1 >> index) & 1);
          const second = flip ? py >= 2 : px >= 2;
          const adjust = MODIFIERS[second ? table1 : table0][modifier];
          const at = ((row * 4 + py) * width + (column * 4 + px)) * 4;
          out[at] = clampByte((second ? r1 : r0) + adjust);
          out[at + 1] = clampByte((second ? g1 : g0) + adjust);
          out[at + 2] = clampByte((second ? b1 : b0) + adjust);
          out[at + 3] = 255;
        }
      }
    }
  }
  return out;
}

/**
 * Field maps are GT1G version 0600, one ETC1 texture. The header records a square
 * (1024×1024 for the story maps) and the payload is tall enough for twice that,
 * with the painting in the top half.
 */
export function decodeFieldMap(g1t: Buffer): { rgba: Buffer; width: number; height: number } {
  if (g1t.subarray(0, 4).toString('latin1') !== 'GT1G') throw new Error('not a g1t');
  const table = g1t.readUInt32LE(0x0c);
  const offset = g1t.readUInt32LE(table);
  const start = table + offset;
  const format = g1t[start + 1];
  const dxdy = g1t[start + 2];
  const width = 1 << (dxdy & 0x0f);
  const height = 1 << (dxdy >> 4);
  if (format !== 0x6f) throw new Error(`unsupported field map format 0x${format.toString(16)}`);
  const data = g1t.subarray(start + 8);
  const decoded = decodeEtc1(data, width, height * 2);
  return { rgba: decoded.subarray(0, width * height * 4), width, height };
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (~crc) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, 'latin1');
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length, 0);
  name.copy(header, 4);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([header, data, crc]);
}

export function encodePng(rgba: Buffer, width: number, height: number): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** The global client's archive: DFFOO_ARCHIVE_ROOT, otherwise archive/gb in this repo. */
function archiveRoot(repo: string): string {
  return process.env.DFFOO_ARCHIVE_ROOT ?? resolve(repo, 'archive', 'gb');
}

function masterRow(repo: string, fieldId: number): { name: string; scaleX: number; scaleY: number } | null {
  const directory = resolve(archiveRoot(repo), 'data', 'data', PACKAGE_NAME, 'files');
  const file = join(directory, `N1${createHash('md5').update('mst_field_disp.json').digest('hex')}`);
  if (!existsSync(file)) return null;
  const decoded = Buffer.from(readFileSync(file).map((byte) => byte ^ 0xff)).toString('utf8');
  const table = JSON.parse(decoded) as Record<string, { background_file_name?: string; disp_scale_x?: number; disp_scale_y?: number }>;
  const row = table[String(fieldId)];
  if (!row?.background_file_name) return null;
  return { name: row.background_file_name, scaleX: row.disp_scale_x || 2, scaleY: row.disp_scale_y || 2 };
}

const located = new Map<string, string | null>();

function findAsset(repo: string, fileName: string): string | null {
  const cached = located.get(fileName);
  if (cached !== undefined) return cached;
  const directory = resolve(archiveRoot(repo), 'sdcard', 'Android', 'data', PACKAGE_NAME, 'files');
  const stack = existsSync(directory) ? [directory] : [];
  while (stack.length) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) stack.push(path);
      else if (entry.name.toLowerCase() === fileName.toLowerCase()) {
        located.set(fileName, path);
        return path;
      }
    }
  }
  located.set(fileName, null);
  return null;
}

/** Decode a field's FieldMap texture to a PNG. Null when the archive has no such map. */
export function fieldMapPng(repo: string, fieldId: number): { png: Buffer; scaleX: number } | null {
  const row = masterRow(repo, fieldId);
  const name = row?.name || `FieldMap_${String(fieldId).padStart(3, '0')}.g1t.dz`;
  const source = findAsset(repo, name);
  if (!source) return null;
  const cache = join(tmpdir(), 'dffoo-fieldmap');
  mkdirSync(cache, { recursive: true });
  const unpacked = join(cache, name.replace(/\.dz$/i, ''));
  if (!existsSync(unpacked)) {
    const copy = join(cache, name);
    writeFileSync(copy, readFileSync(source));
    const tool = resolve(repo, 'tools', 're', 'package', 'build', 'lib', 'app.cjs');
    const dist = resolve(repo, 'tools', 're', 'package', 'dist');
    const result = spawnSync(process.execPath, [tool, '-u', copy], { cwd: dist, encoding: 'utf8' });
    if (result.status !== 0 || !existsSync(unpacked)) {
      throw new Error(result.stderr || result.stdout || `could not unpack ${name}`);
    }
  }
  const image = decodeFieldMap(readFileSync(unpacked));
  return { png: encodePng(image.rgba, image.width, image.height), scaleX: row?.scaleX ?? 2 };
}
