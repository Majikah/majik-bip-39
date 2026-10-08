import { describe, expect, it } from "vitest";
import { MajikBip39 } from "../src/index.js";
import { loadFixture } from "./helpers/fixture.js";

const languages = [
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
] as const;

const entropy = Uint8Array.from({ length: 32 }, (_, index) => index);

describe("BIP-39 mnemonic languages", () => {
  it.each(languages)(
    "encodes, validates, and decodes the %s wordlist",
    async (language) => {
      const mnemonic = await MajikBip39.toMnemonic(entropy, language);

      expect(mnemonic.trim().split(/\s+/)).toHaveLength(24);
      expect(
        await MajikBip39.validateMnemonic(mnemonic, language),
      ).toMatchObject({
        valid: true,
        wordCount: 24,
      });
      expect(await MajikBip39.toEntropy(mnemonic, language)).toEqual(entropy);
    },
  );

  it("uses the selected language when deriving a mnemonic from an image", async () => {
    const bytes = loadFixture("sample_3.png");
    const english = await MajikBip39.derive(bytes, {
      mediaType: "image/png",
    });
    const french = await MajikBip39.derive(bytes, {
      mediaType: "image/png",
      mnemonicLanguage: "fr",
    });

    expect(french.entropy).toEqual(english.entropy);
    expect(
      await MajikBip39.validateMnemonic(french.mnemonic, "fr"),
    ).toMatchObject({
      valid: true,
      wordCount: 24,
    });
  });
});
