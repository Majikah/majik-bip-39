import type { HandlerId, ImageFormat, Scheme } from "./constants.js";
import { MnemonicLanguage } from "./wordlist.js";

/** Resource limits for image inputs. All values are positive integers. */
export interface ImageLimits {
  maxFileBytes: number;
  maxWidth: number;
  maxHeight: number;
  maxPixels: number;
}

export interface DeriveOptions {
  /** Explicit, immutable scheme (e.g. "image-v1"). Omit to resolve a stable default. */
  scheme?: Scheme | `${Scheme}`;
  /** Caller-declared media type, e.g. "image/png". Validated against the bytes. */
  mediaType?: string;
  /**
   * Optional secret. When non-empty, the image digest is stretched with
   * Argon2id. Empty string / undefined means "no passphrase".
   */
  passphrase?: string;
  /** Override default resource limits (limits only reject, never alter output). */
  limits?: Partial<ImageLimits>;

  /** BIP-39 wordlist language the original mnemonic was generated/validated against. Defaults to `"en"`. */
  mnemonicLanguage?: MnemonicLanguage;
}

/** What a handler is asked to look at. */
export interface HandlerInput {
  bytes: Uint8Array;
  mediaType?: string;
}

export interface CanonicalInfo {
  format?: ImageFormat;
  width?: number;
  height?: number;
}

/**
 * Deterministic canonical form of an input. The orchestrator hashes
 * `domain` (UTF-8) followed by every chunk, in order.
 *
 * NOTE: a handler may reuse one buffer across chunks. Consumers must read
 * each chunk synchronously before pulling the next.
 */
export interface CanonicalRepresentation {
  scheme: Scheme;
  handlerId: HandlerId;
  /** Protocol domain separator, e.g. "MajikBIP39/image/v1". */
  domain: string;
  chunks: Iterable<Uint8Array>;
  info: CanonicalInfo;
}

export interface CanonicalizeOptions {
  scheme: Scheme;
  mediaType?: string;
  limits: ImageLimits;
}

export interface InputHandler {
  readonly id: HandlerId;
  readonly schemes: readonly Scheme[];
  /** Cheap, content-based check (magic bytes). Must not decode. */
  canHandle(input: HandlerInput): boolean;
  canonicalize(
    input: HandlerInput,
    options: CanonicalizeOptions,
  ): CanonicalRepresentation;
}

export interface Bip39DerivationResult {
  /** Standard 24-word BIP-39 mnemonic. Sensitive. */
  mnemonic: string;
  /** 256-bit BIP-39 entropy. Sensitive. */
  entropy: Uint8Array;
  scheme: Scheme;
  handler: HandlerId;
  passphraseUsed: boolean;
  canonicalization: CanonicalInfo;
}

export interface MnemonicValidation {
  valid: boolean;
  wordCount: number;
}
