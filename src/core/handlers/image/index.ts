import {
  HandlerId,
  ImageFormat,
  MEDIA_TYPE_TO_FORMAT,
  PROTOCOL_DOMAIN,
  Scheme,
} from "../../constants.js";
import {
  InvalidInputError,
  UnsupportedFormatError,
  UnsupportedSchemeError,
} from "../../errors.js";
import type {
  CanonicalizeOptions,
  CanonicalRepresentation,
  HandlerInput,
  InputHandler,
} from "../../types.js";
import { assertFileSize } from "../../validators.js";
import { imageV1Chunks } from "./canonicalize.js";
import { detectImageFormat } from "./detect.js";
import { decodePngToRows } from "./png.js";

export class ImageHandler implements InputHandler {
  readonly id = HandlerId.IMAGE;
  readonly schemes = [Scheme.IMAGE_V1] as const;

  canHandle(input: HandlerInput): boolean {
    return detectImageFormat(input.bytes) !== undefined;
  }

  canonicalize(
    input: HandlerInput,
    options: CanonicalizeOptions,
  ): CanonicalRepresentation {
    if (options.scheme !== Scheme.IMAGE_V1) {
      throw new UnsupportedSchemeError(`image handler does not support scheme "${options.scheme}"`);
    }
    assertFileSize(input.bytes.length, options.limits);

    // Never trust a declared type or extension: detect from the bytes, and
    // require any declared media type to agree.
    const detected = detectImageFormat(input.bytes);
    if (detected === undefined) {
      throw new UnsupportedFormatError("unrecognized image format");
    }
    if (input.mediaType !== undefined) {
      const declared = MEDIA_TYPE_TO_FORMAT[input.mediaType.toLowerCase()];
      if (declared === undefined) {
        throw new InvalidInputError("declared media type is not a supported image type");
      }
      if (declared !== detected) {
        throw new InvalidInputError("declared media type does not match the file contents");
      }
    }

    switch (detected) {
      case ImageFormat.PNG: {
        const { width, height, rows } = decodePngToRows(input.bytes, options.limits);
        return {
          scheme: Scheme.IMAGE_V1,
          handlerId: this.id,
          domain: PROTOCOL_DOMAIN[Scheme.IMAGE_V1],
          chunks: imageV1Chunks(width, height, rows()),
          info: { format: ImageFormat.PNG, width, height },
        };
      }
      // Next: JPEG (integer-only IDCT), BMP, WebP, TIFF.
      default:
        throw new UnsupportedFormatError(`${detected} images are not supported yet`);
    }
  }
}

export const imageHandler = new ImageHandler();
