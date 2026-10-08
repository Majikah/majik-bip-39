import { decode as decodePng } from "fast-png";
import {
  InvalidImageError,
  UnsupportedAnimationError,
  UnsupportedColorModelError,
} from "../../errors.js";
import type { ImageLimits } from "../../types.js";
import { assertDimensions } from "../../validators.js";

export interface DecodedRows {
  width: number;
  height: number;
  /** Canonical RGBA8 rows, top-to-bottom. The yielded buffer is REUSED. */
  rows(): Generator<Uint8Array, void, undefined>;
}

interface PngHeader {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  chunkTypes: Set<string>;
}

/** Channels per pixel for the colour types v1 supports. */
const CHANNELS_BY_COLOR_TYPE: Readonly<Record<number, number>> = {
  0: 1, // grayscale
  2: 3, // RGB
  4: 2, // grayscale + alpha
  6: 4, // RGBA
};

/**
 * Parse IHDR and scan chunk types up to the first IDAT, WITHOUT inflating
 * anything. This lets us reject on size / animation / colour model before any
 * pixel memory is allocated.
 */
function readHeader(bytes: Uint8Array): PngHeader {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8; // after signature
  const chunkTypes = new Set<string>();
  let header: Omit<PngHeader, "chunkTypes"> | undefined;

  while (pos + 8 <= bytes.length) {
    const length = view.getUint32(pos, false);
    const type = String.fromCharCode(
      bytes[pos + 4]!, bytes[pos + 5]!, bytes[pos + 6]!, bytes[pos + 7]!,
    );
    if (pos + 12 + length > bytes.length) {
      throw new InvalidImageError("PNG chunk exceeds file length");
    }
    chunkTypes.add(type);

    if (type === "IHDR") {
      if (length !== 13) throw new InvalidImageError("PNG IHDR has invalid length");
      header = {
        width: view.getUint32(pos + 8, false),
        height: view.getUint32(pos + 12, false),
        bitDepth: bytes[pos + 16]!,
        colorType: bytes[pos + 17]!,
      };
    } else if (header === undefined) {
      throw new InvalidImageError("PNG IHDR must be the first chunk");
    }
    if (type === "IDAT" || type === "IEND") break;
    pos += 12 + length;
  }

  if (header === undefined) throw new InvalidImageError("PNG has no IHDR chunk");
  return { ...header, chunkTypes };
}

/** round(v * 255 / 65535) in exact integer arithmetic. */
function to8(v16: number): number {
  return Math.floor((v16 * 255 + 32767) / 65535);
}

/**
 * Decode a PNG and expose canonical RGBA8 rows (image-v1 rules):
 *  - grayscale replicated to RGB; no alpha => A = 255
 *  - 16-bit samples reduced with round(v*255/65535)
 *  - ICC / gAMA / cHRM / sRGB / eXIf chunks are ignored (raw sample values)
 *  - rejected rather than guessed: APNG, palette, tRNS, bit depth < 8
 */
export function decodePngToRows(bytes: Uint8Array, limits: ImageLimits): DecodedRows {
  const h = readHeader(bytes);

  if (h.chunkTypes.has("acTL")) {
    throw new UnsupportedAnimationError("animated PNG (APNG) is not supported");
  }
  const channelsMaybe = CHANNELS_BY_COLOR_TYPE[h.colorType];
  if (channelsMaybe === undefined) {
    throw new UnsupportedColorModelError("PNG palette/indexed images are not supported yet");
  }
  if (h.bitDepth !== 8 && h.bitDepth !== 16) {
    throw new UnsupportedColorModelError("PNG bit depths below 8 are not supported yet");
  }
  if (h.chunkTypes.has("tRNS")) {
    throw new UnsupportedColorModelError("PNG tRNS transparency is not supported yet");
  }
  const channels: number = channelsMaybe;
  assertDimensions(h.width, h.height, limits);

  let decoded;
  try {
    decoded = decodePng(bytes);
  } catch (err) {
    throw new InvalidImageError("failed to decode PNG", err);
  }

  const expectedLength = h.width * h.height * channels;
  if (
    decoded.width !== h.width ||
    decoded.height !== h.height ||
    decoded.channels !== channels ||
    decoded.depth !== h.bitDepth ||
    decoded.data.length !== expectedLength
  ) {
    throw new InvalidImageError("decoded PNG does not match its header");
  }

  const { width, height } = h;
  const data = decoded.data; // Uint8Array (8-bit) or Uint16Array (16-bit)
  const sixteen = h.bitDepth === 16;

  function* rows(): Generator<Uint8Array, void, undefined> {
    const row = new Uint8Array(width * 4);
    for (let y = 0; y < height; y++) {
      let src = y * width * channels;
      for (let x = 0, dst = 0; x < width; x++, dst += 4) {
        const s = (i: number): number => {
          const v = data[src + i]!;
          return sixteen ? to8(v) : v;
        };
        if (channels === 1) {
          const g = s(0);
          row[dst] = g; row[dst + 1] = g; row[dst + 2] = g; row[dst + 3] = 255;
        } else if (channels === 2) {
          const g = s(0);
          row[dst] = g; row[dst + 1] = g; row[dst + 2] = g; row[dst + 3] = s(1);
        } else if (channels === 3) {
          row[dst] = s(0); row[dst + 1] = s(1); row[dst + 2] = s(2); row[dst + 3] = 255;
        } else {
          row[dst] = s(0); row[dst + 1] = s(1); row[dst + 2] = s(2); row[dst + 3] = s(3);
        }
        src += channels;
      }
      yield row;
    }
  }

  return { width, height, rows };
}
