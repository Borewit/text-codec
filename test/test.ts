import { expect } from "chai";
import {
  textEncode,
  textDecode,
  TextEncoder as PolyfillTextEncoder,
  TextDecoder as PolyfillTextDecoder,
  type SupportedEncoding
} from "../lib/index.js";

const encodings: [SupportedEncoding, string][] = [
  ["utf-8", "Hello 🌍"],
  ["utf-16le", "Hello 🌍"],
  ["ascii", "Hello!"],
  ["latin1", "Héllo ¢"],
  ["windows-1252", "Hello €—World"],
];

describe("TextEncoder (polyfill)", () => {
  encodings.forEach(([encoding, sample]) => {
    it(`should encode ${encoding} correctly`, () => {
      const encoder = new PolyfillTextEncoder(encoding);
      const bytes = encoder.encode(sample);
      const decoded = textDecode(bytes, encoding);
      expect(decoded).to.equal(sample);
    });
  });

  describe("UTF-8 special cases", () => {
    it("handles empty string", () => {
      const encoder = new PolyfillTextEncoder("utf-8");
      expect(textDecode(encoder.encode(""), "utf-8")).to.equal("");
    });

    it("handles multi-byte chars (emoji)", () => {
      const str = "🙂🙃";
      const encoder = new PolyfillTextEncoder("utf-8");
      expect(textDecode(encoder.encode(str), "utf-8")).to.equal(str);
    });

    it("handles surrogate pairs", () => {
      const str = "𝄞"; // U+1D11E
      const encoder = new PolyfillTextEncoder("utf-8");
      expect(textDecode(encoder.encode(str), "utf-8")).to.equal(str);
    });
  });
});

describe("TextDecoder (polyfill)", () => {
  encodings.forEach(([encoding, sample]) => {
    it(`should decode ${encoding} correctly`, () => {
      const decoder = new PolyfillTextDecoder(encoding);
      const bytes = textEncode(sample, encoding);
      const decoded = decoder.decode(bytes);
      expect(decoded).to.equal(sample);
    });
  });

  describe("ASCII special case", () => {
    it("strips high bits when decoding", () => {
      const decoder = new PolyfillTextDecoder("ascii");
      const bytes = new Uint8Array([0x7f, 0x80, 0xff]);
      expect(decoder.decode(bytes)).to.equal(String.fromCharCode(0x7f, 0x00, 0x7f));
    });
  });

  describe("Windows-1252 special cases", () => {
    it("correctly maps extended chars", () => {
      const str = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
      const bytes = textEncode(str, "windows-1252");
      const decoder = new PolyfillTextDecoder("windows-1252");
      expect(decoder.decode(bytes)).to.equal(str);
    });

    it("replaces unsupported chars with ?", () => {
      const str = "あ"; // Not representable
      const bytes = textEncode(str, "windows-1252");
      const decoder = new PolyfillTextDecoder("windows-1252");
      expect(decoder.decode(bytes)).to.equal("?");
    });
  });
});
