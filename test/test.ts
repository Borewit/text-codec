import { expect } from "chai";
import { textEncode, textDecode, type SupportedEncoding } from "../lib/index.js";

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

    describe("fallback decoder/encoder", () => {
      let originalTextDecoder: typeof globalThis.TextDecoder | undefined;
      let originalTextEncoder: typeof globalThis.TextEncoder | undefined;

      before(() => {
        originalTextDecoder = globalThis.TextDecoder;
        originalTextEncoder = globalThis.TextEncoder;
        // Force fallback path
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).TextDecoder = undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).TextEncoder = undefined;
      });

      after(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).TextDecoder = originalTextDecoder;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).TextEncoder = originalTextEncoder;
      });

      it("should strip UTF-8 BOM like native TextDecoder", () => {
        const bytes = Uint8Array.of(0xef, 0xbb, 0xbf, 0x42);
        expect(textDecode(bytes, "utf-8")).to.equal("B");
      });

      it("should replace an invalid continuation byte used as a leading byte", () => {
        const bytes = Uint8Array.of(0x80);
        expect(textDecode(bytes, "utf-8")).to.equal("\uFFFD");
      });

      it("should replace truncated 4-byte sequences", () => {
        const bytes = Uint8Array.of(0xf0, 0x90, 0x80);
        expect(textDecode(bytes, "utf-8")).to.equal("\uFFFD\uFFFD\uFFFD");
      });

      it("should replace malformed 4-byte overlong sequences", () => {
        const bytes = Uint8Array.of(0xf0, 0x80, 0x80);
        expect(textDecode(bytes, "utf-8")).to.equal("\uFFFD\uFFFD\uFFFD");
      });

      it("should replace malformed UTF-8 instead of producing garbage output", () => {
        const bytes = Uint8Array.of(0x00, 0xfe, 0xff);
        expect(textDecode(bytes, "utf-8")).to.equal("\u0000\uFFFD\uFFFD");
      });

      it("should replace lone high surrogate on UTF-8 encode", () => {
        const bytes = textEncode("\ud800", "utf-8");
        expect([...bytes]).to.deep.equal([0xef, 0xbf, 0xbd]);
      });

      it("should replace lone low surrogate on UTF-8 encode", () => {
        const bytes = textEncode("\udc00", "utf-8");
        expect([...bytes]).to.deep.equal([0xef, 0xbf, 0xbd]);
      });

      it("should encode valid surrogate pairs correctly", () => {
        const bytes = textEncode("𝄞", "utf-8");
        expect([...bytes]).to.deep.equal([0xf0, 0x9d, 0x84, 0x9e]);
      });
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

    it("should replace odd trailing byte with U+FFFD", () => {
      const bytes = Uint8Array.of(0x41, 0x00, 0x42);
      expect(textDecode(bytes, "utf-16le")).to.equal("A\uFFFD");
    });

    it("should replace lone high surrogate with U+FFFD", () => {
      // 0xD800 little-endian
      const bytes = Uint8Array.of(0x00, 0xd8);
      expect(textDecode(bytes, "utf-16le")).to.equal("\uFFFD");
    });

    it("should replace lone low surrogate with U+FFFD", () => {
      // 0xDC00 little-endian
      const bytes = Uint8Array.of(0x00, 0xdc);
      expect(textDecode(bytes, "utf-16le")).to.equal("\uFFFD");
    });

    it("should replace an unpaired high surrogate followed by BMP code unit", () => {
      // D800 followed by 'A'
      const bytes = Uint8Array.of(0x00, 0xd8, 0x41, 0x00);
      expect(textDecode(bytes, "utf-16le")).to.equal("\uFFFDA");
    });

    it("should replace lone high surrogate on encode", () => {
      const bytes = textEncode("\ud800", "utf-16le");
      expect([...bytes]).to.deep.equal([0xfd, 0xff]);
    });

    it("should replace lone low surrogate on encode", () => {
      const bytes = textEncode("\udc00", "utf-16le");
      expect([...bytes]).to.deep.equal([0xfd, 0xff]);
    });

    it("should preserve valid surrogate pairs on encode", () => {
      const bytes = textEncode("😀", "utf-16le");
      expect([...bytes]).to.deep.equal([0x3d, 0xd8, 0x00, 0xde]);
    });
  });

  describe("ASCII", () => {
    it("should strip high bits when encoding", () => {
      const str = String.fromCharCode(0x7f, 0x80, 0xff);
      const bytes = textEncode(str, "ascii");
      expect([...bytes]).to.deep.equal([0x7f, 0x00, 0x7f]);
    });

    it("should strip high bits when decoding", () => {
      const bytes = Uint8Array.of(0x7f, 0x80, 0xff);
      expect(textDecode(bytes, "ascii")).to.equal(
        String.fromCharCode(0x7f, 0x00, 0x7f)
      );
    });
  });

  describe("Latin-1", () => {
    it("should encode/decode high Latin-1 chars", () => {
      const str = "ÿþý";
      expect(textDecode(textEncode(str, "latin1"), "latin1")).to.equal(str);
    });

    it("should directly decode bytes 0x00..0xFF", () => {
      const bytes = Uint8Array.of(0x41, 0xe9, 0xff);
      expect(textDecode(bytes, "latin1")).to.equal("Aéÿ");
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
      const str = "あ";
      const bytes = textEncode(str, "windows-1252");
      expect(bytes[0]).to.equal(0x3f);
    });

    it("should map special bytes in 0x80..0x9F range correctly on decode", () => {
      const bytes = Uint8Array.of(
        0x80, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
        0x8a, 0x8b, 0x8c, 0x8e, 0x91, 0x92, 0x93, 0x94, 0x95,
        0x96, 0x97, 0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9e, 0x9f
      );
      expect(textDecode(bytes, "windows-1252")).to.equal(
        "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"
      );
    });

    it("should encode Windows-1252 extensions to their correct byte values", () => {
      const str = "€—Ÿ";
      const bytes = textEncode(str, "windows-1252");
      expect([...bytes]).to.deep.equal([0x80, 0x97, 0x9f]);
    });

    it("should not mis-encode undefined C1 controls as printable extensions", () => {
      const str = "\u0081\u008d\u008f\u0090\u009d";
      const bytes = textEncode(str, "windows-1252");
      expect([...bytes]).to.deep.equal([0x3f, 0x3f, 0x3f, 0x3f, 0x3f]);
    });
  });

  describe("Errors", () => {
    it("should throw on unsupported decode encoding", () => {
      expect(() =>
        textDecode(Uint8Array.of(0x41), "utf-32" as SupportedEncoding)
      ).to.throw(RangeError, "Encoding 'utf-32' not supported");
    });

    it("should throw on unsupported encode encoding", () => {
      expect(() =>
        textEncode("A", "utf-32" as SupportedEncoding)
      ).to.throw(RangeError, "Encoding 'utf-32' not supported");
    });
  });
});
