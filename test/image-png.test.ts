import { encode } from "fast-png";
import { describe, expect, it } from "vitest";
import { ErrorCode, MajikBip39 } from "../src/index.js";

const W = 7,
  H = 5;
function rgba(): Uint8Array {
  const d = new Uint8Array(W * H * 4);
  for (let i = 0; i < d.length; i++) d[i] = (i * 37 + 11) & 255;
  for (let i = 3; i < d.length; i += 4) d[i] = 255;
  return d;
}
const png = (o: Parameters<typeof encode>[0]) => encode(o);

const rgbaPng = () =>
  png({ width: W, height: H, channels: 4, depth: 8, data: rgba() });
const rgbPng = () => {
  const src = rgba(),
    d = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) d.set(src.subarray(i * 4, i * 4 + 3), i * 3);
  return png({ width: W, height: H, channels: 3, depth: 8, data: d });
};

describe("image-v1 (PNG)", () => {
  it("is deterministic and yields a valid 24-word BIP-39 mnemonic", async () => {
    const a = await MajikBip39.fromBytes(rgbaPng());
    const b = await MajikBip39.fromBytes(rgbaPng());
    expect(a).toBe(b);
    expect(a.split(" ")).toHaveLength(24);
    const validation = await MajikBip39.validateMnemonic(a);
    expect(validation.valid).toBe(true);
  });

  it("RGB and RGBA(A=255) with identical pixels give the same mnemonic", async () => {
    expect(await MajikBip39.fromBytes(rgbPng())).toBe(
      await MajikBip39.fromBytes(rgbaPng()),
    );
  });

  it("different pixels give different mnemonics", async () => {
    const d = rgba();
    d[0] = (d[0]! + 1) & 255;
    const other = png({ width: W, height: H, channels: 4, depth: 8, data: d });
    expect(await MajikBip39.fromBytes(other)).not.toBe(
      await MajikBip39.fromBytes(rgbaPng()),
    );
  });

  it("grayscale expands like RGB with equal channels", async () => {
    const g = new Uint8Array(W * H).map((_, i) => (i * 13) & 255);
    const rgb = new Uint8Array(W * H * 3);
    g.forEach((v, i) => rgb.set([v, v, v], i * 3));
    const a = await MajikBip39.fromBytes(
      png({ width: W, height: H, channels: 1, depth: 8, data: g }),
    );
    const b = await MajikBip39.fromBytes(
      png({ width: W, height: H, channels: 3, depth: 8, data: rgb }),
    );
    expect(a).toBe(b);
  });

  it("16-bit input reduces with round(v*255/65535)", async () => {
    const d8 = rgba();
    const d16 = new Uint16Array(d8.length).map((_, i) => d8[i]! * 257); // exact 8->16
    const a = await MajikBip39.fromBytes(
      png({ width: W, height: H, channels: 4, depth: 16, data: d16 }),
    );
    expect(a).toBe(await MajikBip39.fromBytes(rgbaPng()));
  });

  it("passphrase changes the result, is deterministic, and NFKD-normalizes", async () => {
    const base = await MajikBip39.fromBytes(rgbaPng());
    const p1 = await MajikBip39.fromBytes(rgbaPng(), { passphrase: "e\u0301" }); // e + combining acute
    const p2 = await MajikBip39.fromBytes(rgbaPng(), { passphrase: "\u00e9" }); // precomposed é
    expect(p1).toBe(p2);
    expect(p1).not.toBe(base);
    expect(await MajikBip39.fromBytes(rgbaPng(), { passphrase: "" })).toBe(
      base,
    );
  }, 60_000);

  it("rejects declared/actual mismatch, garbage, and over-limit images with stable codes", async () => {
    await expect(
      MajikBip39.fromBytes(rgbaPng(), { mediaType: "image/jpeg" }),
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_INPUT });
    await expect(
      MajikBip39.fromBytes(new Uint8Array([1, 2, 3, 4])),
    ).rejects.toMatchObject({ code: ErrorCode.HANDLER_NOT_FOUND });
    await expect(
      MajikBip39.fromBytes(rgbaPng(), { limits: { maxPixels: 10 } }),
    ).rejects.toMatchObject({ code: ErrorCode.RESOURCE_LIMIT_EXCEEDED });
    await expect(
      MajikBip39.fromBytes(rgbaPng().subarray(0, 40)),
    ).rejects.toBeInstanceOf(Error);
  });

  it("JPEG is recognized but reported as not yet supported", async () => {
    await expect(
      MajikBip39.fromBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])),
    ).rejects.toMatchObject({ code: ErrorCode.UNSUPPORTED_FORMAT });
  });
});
