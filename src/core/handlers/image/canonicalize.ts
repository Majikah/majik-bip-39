import { concatBytes, u32be } from "../../utils.js";

/**
 * image-v1 canonical byte layout (after the UTF-8 domain separator):
 *
 *   width   u32 big-endian
 *   height  u32 big-endian
 *   pixels  RGBA8, rows top-to-bottom, pixels left-to-right
 *
 * Every byte is defined; no metadata, no format, no media type is included.
 */
export function* imageV1Chunks(
  width: number,
  height: number,
  rows: Iterable<Uint8Array>,
): Generator<Uint8Array, void, undefined> {
  yield concatBytes(u32be(width), u32be(height));
  yield* rows;
}
