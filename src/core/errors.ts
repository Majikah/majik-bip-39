import { ErrorCode } from "./constants.js";

/**
 * Base error. Callers branch on `code`, never on `message`.
 * Messages must NEVER contain entropy, mnemonics, passphrases or input bytes.
 */
export class MajikBip39Error extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export class InvalidInputError extends MajikBip39Error {
  constructor(message: string, cause?: unknown) {
    super(ErrorCode.INVALID_INPUT, message, { cause });
  }
}

export class InvalidOptionError extends MajikBip39Error {
  constructor(message: string) {
    super(ErrorCode.INVALID_OPTION, message);
  }
}

export class UnsupportedFormatError extends MajikBip39Error {
  constructor(message: string) {
    super(ErrorCode.UNSUPPORTED_FORMAT, message);
  }
}

export class UnsupportedSchemeError extends MajikBip39Error {
  constructor(message: string) {
    super(ErrorCode.UNSUPPORTED_SCHEME, message);
  }
}

export class HandlerNotFoundError extends MajikBip39Error {
  constructor(message: string) {
    super(ErrorCode.HANDLER_NOT_FOUND, message);
  }
}

/** Malformed / corrupt image, or decoder failure. */
export class InvalidImageError extends MajikBip39Error {
  constructor(message: string, cause?: unknown) {
    super(ErrorCode.IMAGE_INVALID, message, { cause });
  }
}

export class UnsupportedAnimationError extends MajikBip39Error {
  constructor(message: string) {
    super(ErrorCode.IMAGE_UNSUPPORTED_ANIMATION, message);
  }
}

export class UnsupportedColorModelError extends MajikBip39Error {
  constructor(message: string) {
    super(ErrorCode.IMAGE_UNSUPPORTED_COLOR_MODEL, message);
  }
}

export class ResourceLimitError extends MajikBip39Error {
  constructor(message: string) {
    super(ErrorCode.RESOURCE_LIMIT_EXCEEDED, message);
  }
}

export class InvalidMnemonicError extends MajikBip39Error {
  constructor(message: string) {
    super(ErrorCode.INVALID_MNEMONIC, message);
  }
}

export class InvalidEntropyLengthError extends MajikBip39Error {
  constructor(message: string) {
    super(ErrorCode.INVALID_ENTROPY_LENGTH, message);
  }
}
