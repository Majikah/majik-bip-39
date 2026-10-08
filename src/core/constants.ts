/**
 * Constants and enums. Everything in the PROTOCOL / ARGON2 sections is part of
 * a frozen protocol version: changing a value changes users' derived
 * mnemonics, so it requires a NEW scheme id (e.g. image-v2), never an edit.
 */

export enum ErrorCode {
  INVALID_INPUT = "INVALID_INPUT",
  INVALID_OPTION = "INVALID_OPTION",
  UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT",
  UNSUPPORTED_SCHEME = "UNSUPPORTED_SCHEME",
  HANDLER_NOT_FOUND = "HANDLER_NOT_FOUND",
  IMAGE_INVALID = "IMAGE_INVALID",
  IMAGE_UNSUPPORTED_ANIMATION = "IMAGE_UNSUPPORTED_ANIMATION",
  IMAGE_UNSUPPORTED_COLOR_MODEL = "IMAGE_UNSUPPORTED_COLOR_MODEL",
  RESOURCE_LIMIT_EXCEEDED = "RESOURCE_LIMIT_EXCEEDED",
  INVALID_MNEMONIC = "INVALID_MNEMONIC",
  INVALID_ENTROPY_LENGTH = "INVALID_ENTROPY_LENGTH",
}

export enum ImageFormat {
  PNG = "png",
  JPEG = "jpeg",
  BMP = "bmp",
  WEBP = "webp",
  TIFF = "tiff",
}

export enum MediaType {
  PNG = "image/png",
  JPEG = "image/jpeg",
  BMP = "image/bmp",
  WEBP = "image/webp",
  TIFF = "image/tiff",
}

export enum HandlerId {
  IMAGE = "image",
  // AUDIO = "audio",  (planned)
  // VIDEO = "video",  (planned)
}

/** Concrete, immutable derivation schemes. */
export enum Scheme {
  IMAGE_V1 = "image-v1",
}

export const MEDIA_TYPE_TO_FORMAT: Readonly<Record<string, ImageFormat>> = {
  [MediaType.PNG]: ImageFormat.PNG,
  [MediaType.JPEG]: ImageFormat.JPEG,
  "image/jpg": ImageFormat.JPEG,
  [MediaType.BMP]: ImageFormat.BMP,
  [MediaType.WEBP]: ImageFormat.WEBP,
  [MediaType.TIFF]: ImageFormat.TIFF,
};

/** Scheme a handler resolves to when the caller does not name one. Never changes. */
export const DEFAULT_SCHEME_BY_HANDLER: Readonly<Record<HandlerId, Scheme>> = {
  [HandlerId.IMAGE]: Scheme.IMAGE_V1,
};

// ---------------------------------------------------------------- PROTOCOL --

/** Domain separators (UTF-8). Hashed first, so schemes can never collide. */
export const PROTOCOL_DOMAIN: Readonly<Record<Scheme, string>> = {
  [Scheme.IMAGE_V1]: "MajikBIP39/image/v1",
};

/** Suffix appended to a scheme domain to form the Argon2id salt domain. */
export const SALT_DOMAIN_SUFFIX = "/salt";

/** 256-bit entropy => 24-word BIP-39 mnemonic. */
export const ENTROPY_BYTES = 32;

/** Argon2id parameters for passphrase mode. FROZEN for *-v1 schemes. */
export const ARGON2_V1 = Object.freeze({
  /** memory in KiB (64 MiB) */
  m: 65536,
  t: 3,
  p: 1,
  dkLen: ENTROPY_BYTES,
});

// ------------------------------------------------------------------ LIMITS --

/**
 * Default resource limits. Limits only ever REJECT input; they never change
 * the derived output of an input that is accepted, so they are configurable
 * without affecting protocol determinism.
 */
export const DEFAULT_IMAGE_LIMITS = Object.freeze({
  maxFileBytes: 64 * 1024 * 1024,
  maxWidth: 16384,
  maxHeight: 16384,
  maxPixels: 64_000_000,
});

export const VALID_ENTROPY_BYTE_LENGTHS: readonly number[] = [16, 20, 24, 28, 32];
