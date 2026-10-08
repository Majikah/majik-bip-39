import { InvalidInputError } from "./errors.js";

const textEncoder = new TextEncoder();

export function utf8(text: string): Uint8Array {
  return textEncoder.encode(text);
}

/** Unsigned 32-bit big-endian. */
export function u32be(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new InvalidInputError("u32be: value out of range");
  }
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, false);
  return out;
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

/** Overflow-safe multiplication of non-negative integers (throws past 2^53). */
export function checkedMul(a: number, b: number): number {
  const r = a * b;
  if (!Number.isSafeInteger(r)) {
    throw new InvalidInputError("integer overflow in size computation");
  }
  return r;
}

/** Best-effort wipe of a temporary buffer (JS cannot guarantee zeroization). */
export function wipe(bytes: Uint8Array): void {
  bytes.fill(0);
}
