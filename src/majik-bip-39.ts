import { sha256 } from "@noble/hashes/sha2.js";
import { argon2idAsync } from "@noble/hashes/argon2.js";
import {
  entropyToMnemonic,
  mnemonicToEntropy,
  validateMnemonic as scureValidate,
} from "@scure/bip39";

import {
  ARGON2_V1,
  DEFAULT_SCHEME_BY_HANDLER,
  HandlerId,
  MEDIA_TYPE_TO_FORMAT,
  SALT_DOMAIN_SUFFIX,
  Scheme,
  VALID_ENTROPY_BYTE_LENGTHS,
} from "./core/constants.js";
import {
  HandlerNotFoundError,
  InvalidEntropyLengthError,
  InvalidInputError,
  InvalidMnemonicError,
  InvalidOptionError,
  UnsupportedSchemeError,
} from "./core/errors.js";
import { imageHandler } from "./core/handlers/image/index.js";
import type {
  Bip39DerivationResult,
  DeriveOptions,
  InputHandler,
  MnemonicValidation,
} from "./core/types.js";
import { utf8, wipe } from "./core/utils.js";
import {
  assertBytes,
  normalizePassphrase,
  resolveImageLimits,
} from "./core/validators.js";
import { MnemonicLanguage, WORDLISTS } from "./core/wordlist.js";

/**
 * Orchestrator. Turns a supported input (image for now; audio/video planned)
 * into a standard BIP-39 mnemonic via a versioned canonical representation.
 *
 * It never redefines BIP-39: it only produces valid 256-bit entropy.
 */
export class MajikBip39 {
  private static readonly handlers: readonly InputHandler[] = [imageHandler];

  // ------------------------------------------------------------ high level --

  /** Blob/File adapter (browser, Node 18+). Core logic is bytes-only. */
  static async fromFile(
    file: Blob,
    options: DeriveOptions = {},
  ): Promise<string> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return MajikBip39.fromBytes(bytes, {
      mediaType: file.type || undefined,
      ...options,
    });
  }

  static async fromBytes(
    bytes: Uint8Array,
    options: DeriveOptions = {},
  ): Promise<string> {
    return (await MajikBip39.derive(bytes, options)).mnemonic;
  }

  static async deriveMnemonic(
    bytes: Uint8Array,
    options: DeriveOptions = {},
  ): Promise<string> {
    return MajikBip39.fromBytes(bytes, options);
  }

  static async deriveEntropy(
    bytes: Uint8Array,
    options: DeriveOptions = {},
  ): Promise<Uint8Array> {
    return (await MajikBip39.derive(bytes, options)).entropy;
  }

  // -------------------------------------------------------------- the core --

  static async derive(
    bytes: Uint8Array,
    options: DeriveOptions = {},
  ): Promise<Bip39DerivationResult> {
    assertBytes(bytes);
    const limits = resolveImageLimits(options.limits);
    const passphrase = normalizePassphrase(options.passphrase);

    const { handler, scheme } = MajikBip39.resolve(bytes, options);
    const rep = handler.canonicalize(
      { bytes, mediaType: options.mediaType },
      { scheme, mediaType: options.mediaType, limits },
    );

    // digest = SHA-256( utf8(domain) || canonical chunks )
    const hasher = sha256.create();
    hasher.update(utf8(rep.domain));
    for (const chunk of rep.chunks) hasher.update(chunk);
    const digest = hasher.digest();

    let entropy: Uint8Array;
    if (passphrase === undefined) {
      entropy = digest;
    } else {
      // salt = SHA-256( utf8(domain + "/salt") || digest )  -- needs no extra storage
      const salt = sha256
        .create()
        .update(utf8(rep.domain + SALT_DOMAIN_SUFFIX))
        .update(digest)
        .digest();
      const pw = utf8(passphrase);
      try {
        entropy = await argon2idAsync(pw, salt, { ...ARGON2_V1 });
      } finally {
        wipe(pw);
        wipe(digest);
      }
    }
    const language = options.mnemonicLanguage || "en";
    const loader = WORDLISTS[language];
    if (!loader) throw new InvalidOptionError("Unsupported language");
    const wordlist = await MajikBip39._getWordlist(language);

    return {
      mnemonic: entropyToMnemonic(entropy, wordlist),
      entropy,
      scheme: rep.scheme,
      handler: rep.handlerId,
      passphraseUsed: passphrase !== undefined,
      canonicalization: rep.info,
    };
  }

  // ------------------------------------------------------------ BIP-39 I/O --

  static async toMnemonic(
    entropy: Uint8Array,
    language: MnemonicLanguage = "en",
  ): Promise<string> {
    if (
      !(entropy instanceof Uint8Array) ||
      !VALID_ENTROPY_BYTE_LENGTHS.includes(entropy.length)
    ) {
      throw new InvalidEntropyLengthError(
        "entropy must be 16, 20, 24, 28 or 32 bytes",
      );
    }

    const loader = WORDLISTS[language];
    if (!loader) throw new InvalidMnemonicError("Unsupported language");
    const wordlist = await MajikBip39._getWordlist(language);

    return entropyToMnemonic(entropy, wordlist);
  }

  static async toEntropy(
    mnemonic: string,
    language: MnemonicLanguage = "en",
  ): Promise<Uint8Array> {
    const loader = WORDLISTS[language];
    if (!loader) throw new InvalidMnemonicError("Unsupported language");
    const wordlist = await MajikBip39._getWordlist(language);
    if (!scureValidate(mnemonic, wordlist)) {
      throw new InvalidMnemonicError("not a valid BIP-39 mnemonic");
    }

    return mnemonicToEntropy(mnemonic, wordlist);
  }

  static async validateMnemonic(
    mnemonic: string,
    language: MnemonicLanguage = "en",
  ): Promise<MnemonicValidation> {
    const words =
      typeof mnemonic === "string"
        ? mnemonic.trim().split(/\s+/).filter(Boolean)
        : [];
    const loader = WORDLISTS[language];
    if (!loader) throw new InvalidMnemonicError("Unsupported language");
    const wordlist = await MajikBip39._getWordlist(language);
    return {
      valid: typeof mnemonic === "string" && scureValidate(mnemonic, wordlist),
      wordCount: words.length,
    };
  }

  // -------------------------------------------------------------- registry --

  static listHandlers(): HandlerId[] {
    return MajikBip39.handlers.map((h) => h.id);
  }

  static listSchemes(): Scheme[] {
    return MajikBip39.handlers.flatMap((h) => [...h.schemes]);
  }

  /**
   * Resolution order: explicit scheme -> declared media type -> detected
   * content. No generic fallback yet. Ambiguity is an error, never a guess.
   */
  private static resolve(
    bytes: Uint8Array,
    options: DeriveOptions,
  ): { handler: InputHandler; scheme: Scheme } {
    if (options.scheme !== undefined) {
      const scheme = options.scheme as Scheme;
      const handler = MajikBip39.handlers.find((h) =>
        h.schemes.includes(scheme),
      );
      if (!handler)
        throw new UnsupportedSchemeError(
          `unknown scheme "${String(options.scheme)}"`,
        );
      return { handler, scheme };
    }

    const candidates = MajikBip39.handlers.filter((h) =>
      h.canHandle({ bytes, mediaType: options.mediaType }),
    );
    if (candidates.length === 0) {
      const hint =
        options.mediaType &&
        !(options.mediaType.toLowerCase() in MEDIA_TYPE_TO_FORMAT)
          ? " (declared media type is not supported)"
          : "";
      throw new HandlerNotFoundError(`no handler recognizes this input${hint}`);
    }
    if (candidates.length > 1) {
      throw new InvalidInputError(
        "ambiguous input: multiple handlers match; specify a scheme",
      );
    }
    const handler = candidates[0]!;
    return { handler, scheme: DEFAULT_SCHEME_BY_HANDLER[handler.id] };
  }

  private static async _getWordlist(
    language: MnemonicLanguage,
  ): Promise<string[]> {
    const supported: MnemonicLanguage[] = [
      "en",
      "fr",
      "es",
      "it",
      "ja",
      "ko",
      "czech",
      "pt",
      "zh-cn",
      "zh-tw",
    ];

    if (!supported.includes(language as MnemonicLanguage)) {
      throw new InvalidMnemonicError(
        `Unsupported language: ${String(language)}`,
      );
    }

    const loader = WORDLISTS[language] ?? WORDLISTS.en;

    const mod = await loader();
    return mod.wordlist;
  }
}
