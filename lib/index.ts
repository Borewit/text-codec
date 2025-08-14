export type SupportedEncoding =
  | "utf-8"
  | "utf8"
  | "utf-16le"
  | "ascii"
  | "latin1"
  | "iso-8859-1"
  | "windows-1252";

const WINDOWS_1252_EXTRA: Record<number, string> = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†",
  0x87: "‡", 0x88: "ˆ", 0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ",
  0x8e: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•",
  0x96: "–", 0x97: "—", 0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›",
  0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};

const WINDOWS_1252_REVERSE: Record<string, number> = {};
for (const [code, char] of Object.entries(WINDOWS_1252_EXTRA)) {
  WINDOWS_1252_REVERSE[char] = Number.parseInt(code);
}

/**
 * Decode text from binary data
 */
export function textDecode(
  bytes: Uint8Array,
  encoding: SupportedEncoding = "utf-8"
): string {
  switch (encoding.toLowerCase() as SupportedEncoding) {
    case "utf-8":
    case "utf8":
      return new globalThis.TextDecoder("utf-8").decode(bytes);
    case "utf-16le":
      return decodeUTF16LE(bytes);
    case "ascii":
      return decodeASCII(bytes);
    case "latin1":
    case "iso-8859-1":
      return decodeLatin1(bytes);
    case "windows-1252":
      return decodeWindows1252(bytes);
    default:
      throw new RangeError(`Encoding '${encoding}' not supported`);
  }
}

/**
 * Encode text into binary data
 */
export function textEncode(
  input = "",
  encoding: SupportedEncoding = "utf-8"
): Uint8Array {
  switch (encoding.toLowerCase() as SupportedEncoding) {
    case "utf-8":
    case "utf8":
      if (typeof globalThis.TextEncoder !== "undefined") {
        return new globalThis.TextEncoder().encode(input);
      }
      return encodeUTF8(input); // Hermes fallback
    case "utf-16le":
      return encodeUTF16LE(input);
    case "ascii":
      return encodeASCII(input);
    case "latin1":
    case "iso-8859-1":
      return encodeLatin1(input);
    case "windows-1252":
      return encodeWindows1252(input);
    default:
      throw new RangeError(`Encoding '${encoding}' not supported`);
  }
}

/**
 * Exported TextDecoder polyfill
 */
export class TextDecoder {
  readonly encoding: SupportedEncoding;
  constructor(encoding: SupportedEncoding = "utf-8") {
    this.encoding = encoding;
  }
  decode(bytes: Uint8Array): string {
    return textDecode(bytes, this.encoding);
  }
}

/**
 * Extended TextEncoder polyfill
 * Supports all encodings in SupportedEncoding (non-spec compliant)
 */
export class TextEncoder {
  readonly encoding: SupportedEncoding;
  constructor(encoding: SupportedEncoding = "utf-8") {
    this.encoding = encoding;
  }
  encode(input: string): Uint8Array {
    return textEncode(input, this.encoding);
  }
}

// --- Internal helpers ---

function decodeUTF16LE(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 2) {
    out += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
  }
  return out;
}

function decodeASCII(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes.map((b) => b & 0x7f));
}

function decodeLatin1(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

function decodeWindows1252(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    if (b >= 0x80 && b <= 0x9f && WINDOWS_1252_EXTRA[b]) {
      out += WINDOWS_1252_EXTRA[b];
    } else {
      out += String.fromCharCode(b);
    }
  }
  return out;
}

function encodeUTF8(str: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const cp = str.charCodeAt(i);
    if (cp < 0x80) {
      out.push(cp);
    } else if (cp < 0x800) {
      out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      out.push(
        0xe0 | (cp >> 12),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f)
      );
    } else {
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f)
      );
    }
  }
  return new Uint8Array(out);
}

function encodeUTF16LE(str: string): Uint8Array {
  const out = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    out[i * 2] = code & 0xff;
    out[i * 2 + 1] = code >> 8;
  }
  return out;
}

function encodeASCII(str: string): Uint8Array {
  return new Uint8Array([...str].map((ch) => ch.charCodeAt(0) & 0x7f));
}

function encodeLatin1(str: string): Uint8Array {
  return new Uint8Array([...str].map((ch) => ch.charCodeAt(0) & 0xff));
}

function encodeWindows1252(str: string): Uint8Array {
  return new Uint8Array(
    [...str].map((ch) => {
      const code = ch.charCodeAt(0);
      if (code <= 0xff) return code;
      if (WINDOWS_1252_REVERSE[ch] !== undefined)
        return WINDOWS_1252_REVERSE[ch];
      return 0x3f; // '?'
    })
  );
}
