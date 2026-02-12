import { expect } from "chai";
import { toHex } from "@exodus/bytes/hex.js";
import { textEncode, textDecode, type SupportedEncoding } from '../lib/index.js';

const nonUtf8 = [
  { bytes: [0, 254, 255], charcodes: [0, 0xff_fd, 0xff_fd] },
  { bytes: [0x80], charcodes: [0xff_fd] },
  { bytes: [0xf0, 0x90, 0x80], charcodes: [0xff_fd] },
  { bytes: [0xf0, 0x80, 0x80], charcodes: [0xff_fd, 0xff_fd, 0xff_fd] },
]

const orphans = [
  { charcodes: [0x61, 0x62, 0xd8_00, 0x77, 0x78], replaced: [0x61, 0x62, 0xff_fd, 0x77, 0x78], utf8: '6162efbfbd7778' },
  { charcodes: [0xd8_00], replaced: [0xff_fd], utf8: 'efbfbd' },
  { charcodes: [0xd8_00, 0xd8_00], replaced: [0xff_fd, 0xff_fd], utf8: 'efbfbdefbfbd' },
  { charcodes: [0x61, 0x62, 0xdf_ff, 0x77, 0x78], replaced: [0x61, 0x62, 0xff_fd, 0x77, 0x78], utf8: '6162efbfbd7778' },
  { charcodes: [0xdf_ff, 0xd8_00], replaced: [0xff_fd, 0xff_fd], utf8: 'efbfbdefbfbd' },
]

describe("Text polyfill encode/decode", () => {
  const encodings: [SupportedEncoding, string][] = [
    ["utf-8", "Hello 🌍"],
    ["utf-16le", "Hello 🌍"],
    ["utf-16be", "Hello 🌍"],
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
    it("should ignore (not remove) BOM", () => {
      expect(textDecode(Uint8Array.of(0xef, 0xbb, 0xbf), "utf-8"), "utf-8").to.equal("\uFEFF");
      expect(textDecode(Uint8Array.of(0xef, 0xbb, 0xbf, 0x42), "utf-8"), "utf-8").to.equal("\uFEFFB");
    });
    it("textDecode replacement", () => {
      for (const { bytes, charcodes } of nonUtf8) {
        const string = String.fromCharCode(...charcodes)
        expect(textDecode(Uint8Array.from(bytes), "utf-8")).to.equal(string);
        expect(textDecode(textEncode(string, "utf-8"), "utf-8")).to.equal(string);
      }
    });
    it("textEncode replacement", () => {
      for (const { charcodes, replaced, utf8 } of orphans) {
        const bytes = textEncode(String.fromCharCode(...charcodes), "utf-8");
        expect(toHex(bytes)).to.equal(utf8);
        expect(textDecode(bytes, "utf-8")).to.equal(String.fromCharCode(...replaced));
      }
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
    it("should ignore (not remove) BOM", () => {
      expect(textDecode(Uint8Array.of(0xff, 0xfe), "utf-16le"), "utf-16le").to.equal("\uFEFF");
      expect(textDecode(Uint8Array.of(0xff, 0xfe, 0x42, 0), "utf-16le"), "utf-16le").to.equal("\uFEFFB");
    });
    it("textDecode replacement", () => {
      for (const { charcodes, replaced } of orphans) {
        const bytes = new Uint8Array(replaced.length * 2);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        for (let i = 0; i < charcodes.length; i++) view.setUint16(i * 2, charcodes[i], true);
        const string = String.fromCharCode(...replaced);
        expect(textDecode(bytes, "utf-16le")).to.equal(string);
        expect(textDecode(textEncode(string, "utf-16le"), "utf-16le")).to.equal(string);
      }
    });
    it("textEncode replacement", () => {
      for (const { charcodes, replaced } of orphans) {
        const bytes = textEncode(String.fromCharCode(...charcodes), "utf-16le");
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        expect(view.byteLength).to.equal(replaced.length * 2);
        for (let i = 0; i < replaced.length; i++) {
          expect(view.getUint16(i * 2, true)).to.equal(replaced[i]);
        }
        expect(textDecode(bytes, "utf-16le")).to.equal(String.fromCharCode(...replaced));
      }
    });
  });

  describe("UTF-16BE", () => {
    it("should handle BMP chars", () => {
      const str = "ABC";
      expect(textDecode(textEncode(str, "utf-16be"), "utf-16be")).to.equal(str);
    });
    it("should handle emoji", () => {
      const str = "😀";
      expect(textDecode(textEncode(str, "utf-16be"), "utf-16be")).to.equal(str);
    });
    it("should ignore (not remove) BOM", () => {
      expect(textDecode(Uint8Array.of(0xfe, 0xff), "utf-16be"), "utf-16be").to.equal("\uFEFF");
      expect(textDecode(Uint8Array.of(0xfe, 0xff, 0, 0x42), "utf-16be"), "utf-16be").to.equal("\uFEFFB");
    });
    it("textDecode replacement", () => {
      for (const { charcodes, replaced } of orphans) {
        const bytes = new Uint8Array(replaced.length * 2);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        for (let i = 0; i < charcodes.length; i++) view.setUint16(i * 2, charcodes[i], false);
        const string = String.fromCharCode(...replaced);
        expect(textDecode(bytes, "utf-16be")).to.equal(string);
        expect(textDecode(textEncode(string, "utf-16be"), "utf-16be")).to.equal(string);
      }
    });
    it("textEncode replacement", () => {
      for (const { charcodes, replaced } of orphans) {
        const bytes = textEncode(String.fromCharCode(...charcodes), "utf-16be");
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        expect(view.byteLength).to.equal(replaced.length * 2);
        for (let i = 0; i < replaced.length; i++) {
          expect(view.getUint16(i * 2, false)).to.equal(replaced[i]);
        }
        expect(textDecode(bytes, "utf-16be")).to.equal(String.fromCharCode(...replaced));
      }
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