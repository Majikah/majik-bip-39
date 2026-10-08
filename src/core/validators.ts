import { DEFAULT_IMAGE_LIMITS } from "./constants.js";
import {
  InvalidInputError,
  InvalidOptionError,
  ResourceLimitError,
} from "./errors.js";
import type { ImageLimits } from "./types.js";
import { checkedMul } from "./utils.js";

export function assertBytes(input: unknown): asserts input is Uint8Array {
  if (!(input instanceof Uint8Array)) {
    throw new InvalidInputError("input must be a Uint8Array");
  }
  if (input.length === 0) {
    throw new InvalidInputError("input is empty");
  }
}

/** Merge caller overrides over defaults and validate them. */
export function resolveImageLimits(overrides?: Partial<ImageLimits>): ImageLimits {
  const limits: ImageLimits = { ...DEFAULT_IMAGE_LIMITS, ...overrides };
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new InvalidOptionError(`limit "${key}" must be a positive integer`);
    }
  }
  return limits;
}

export function assertFileSize(byteLength: number, limits: ImageLimits): void {
  if (byteLength > limits.maxFileBytes) {
    throw new ResourceLimitError("input exceeds maxFileBytes");
  }
}

/** Must run BEFORE any decoder allocates pixel memory. */
export function assertDimensions(
  width: number,
  height: number,
  limits: ImageLimits,
): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new InvalidInputError("invalid image dimensions");
  }
  if (width > limits.maxWidth || height > limits.maxHeight) {
    throw new ResourceLimitError("image dimensions exceed limits");
  }
  if (checkedMul(width, height) > limits.maxPixels) {
    throw new ResourceLimitError("image pixel count exceeds maxPixels");
  }
}

/**
 * Passphrase handling for the protocol: NFKD-normalize so the same visible
 * text typed on different platforms matches. No trimming. Empty / undefined
 * means "no passphrase" (the Argon2id step is skipped entirely).
 */
export function normalizePassphrase(passphrase: string | undefined): string | undefined {
  if (passphrase === undefined || passphrase === "") return undefined;
  if (typeof passphrase !== "string") {
    throw new InvalidOptionError("passphrase must be a string");
  }
  return passphrase.normalize("NFKD");
}
