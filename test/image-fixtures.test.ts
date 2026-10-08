import { describe, expect, it } from "vitest";
import { ErrorCode, MajikBip39 } from "../src/index.js";
import { loadFixture } from "./helpers/fixture.js";

describe("image fixtures", () => {
  it("derives the same valid mnemonic from the PNG fixture across three parses", async () => {
    const bytes = loadFixture("sample_3.png");
    const mnemonics: string[] = [];

    for (let iteration = 0; iteration < 3; iteration++) {
      mnemonics.push(
        await MajikBip39.fromBytes(bytes, { mediaType: "image/png" }),
      );
    }

    expect(new Set(mnemonics).size).toBe(1);
    expect(mnemonics[0]!.split(" ")).toHaveLength(24);
    const validation = await MajikBip39.validateMnemonic(mnemonics[0]!);
    expect(validation.valid).toBe(true);
  });

  it.each([
    ["sample_1.jpg", "image/jpeg"],
    ["sample_2.webp", "image/webp"],
  ])(
    "recognizes %s but reports that decoding is unsupported",
    async (filename, mediaType) => {
      await expect(
        MajikBip39.fromBytes(loadFixture(filename), { mediaType }),
      ).rejects.toMatchObject({ code: ErrorCode.UNSUPPORTED_FORMAT });
    },
  );
});
