import { expect } from "chai";
import { textEncode, textDecode, type SupportedEncoding } from '../lib/index.js';

describe("Text polyfill encode/decode", () => {
  const encodings: [SupportedEncoding, string][] = [
    ["utf-8", "Hello 🌍"],
    ["utf-16le", "Hello 🌍"],
    ["ascii", "Hello!"],
    ["latin1", "Héllo ¢"],
    ["windows-1252", "Hello €—World"],
  ];

  encodings.forEach(([encoding, sample]) => {
    it(`should round-trip correctly for ${encoding}`, () => {
      const bytes = textEncode(sample, encoding);
      const decoded = textDecode(bytes, encoding);
      expect(decoded).to.equal(sample);
    });
  });

  describe("UTF-8", () => {
    it("should handle empty string", () => {
      expect(textDecode(textEncode("", "utf-8"), "utf-8")).to.equal("");
    });
    it("should handle multi-byte chars (emoji)", () => {
      const str = "🙂🙃";
      expect(textDecode(textEncode(str, "utf-8"), "utf-8")).to.equal(str);
    });
    it("should handle surrogate pairs", () => {
      const str = "𝄞"; // U+1D11E
      expect(textDecode(textEncode(str, "utf-8"), "utf-8")).to.equal(str);
    });
  });

  describe("UTF-16LE", () => {
    it("should handle BMP chars", () => {
      const str = "ABC";
      expect(textDecode(textEncode(str, "utf-16le"), "utf-16le")).to.equal(str);
    });
    it("should handle emoji", () => {
      const str = "😀";
      expect(textDecode(textEncode(str, "utf-16le"), "utf-16le")).to.equal(str);
    });
  });

  describe("ASCII", () => {
    it("should strip high bits when encoding", () => {
      const str = String.fromCharCode(0x7f, 0x80, 0xff); // last two get masked
      const bytes = textEncode(str, "ascii");
      expect([...bytes]).to.deep.equal([0x7f, 0x00, 0x7f]); // 0x80->0x00, 0xff->0x7f
    });
  });

  describe("Latin-1", () => {
    it("should encode/decode high Latin-1 chars", () => {
      const str = "ÿþý";
      expect(textDecode(textEncode(str, "latin1"), "latin1")).to.equal(str);
    });
  });

  describe("Windows-1252", () => {
    it("should correctly map extended chars", () => {
      const str = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
      const bytes = textEncode(str, "windows-1252");
      const decoded = textDecode(bytes, "windows-1252");
      expect(decoded).to.equal(str);
    });

    it("should replace unsupported chars with ?", () => {
      const str = "あ"; // Not representable
      const bytes = textEncode(str, "windows-1252");
      expect(bytes[0]).to.equal(0x3f); // '?'
    });
  });

});