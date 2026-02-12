import { utf16fromStringLoose, utf16toStringLoose } from "@exodus/bytes/utf16.js";
import { utf8fromStringLoose, utf8toStringLoose } from "@exodus/bytes/utf8.js";

export type SupportedEncoding =
  | "utf-8"
  | "utf8"
  | "utf-16le"
  | "utf-16be"
  | "us-ascii"
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
  WINDOWS_1252_REVERSE[char] = Number.parseInt(code, 10);
}

// Safe chunk size well under your measured ~105k cliff.
// 32k keeps memory reasonable and is plenty fast.
const CHUNK = 32 * 1024;

/**
 * Decode text from binary data
 * @param bytes Binary data
 * @param encoding Encoding
 */
export function textDecode(
  bytes: Uint8Array,
  encoding: SupportedEncoding = "utf-8"
): string {
  switch (encoding.toLowerCase() as SupportedEncoding) {
    case "utf-8":
    case "utf8":
      return utf8toStringLoose(bytes);
    case "utf-16le":
    case "utf-16be": {
      let suffix = "";
      if (bytes.length % 2 === 1) {
        suffix = '\uFFFD';
        bytes = bytes.subarray(0, -1);
      }
      return utf16toStringLoose(bytes, encoding === 'utf-16be' ? 'uint8-be' : 'uint8-le') + suffix;
    }
    case "us-ascii":
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

export function textEncode(
  input = "",
  encoding: SupportedEncoding = "utf-8"
): Uint8Array {
  switch (encoding.toLowerCase() as SupportedEncoding) {
    case "utf-8":
    case "utf8":
      return utf8fromStringLoose(input);
    case "utf-16le":
      return utf16fromStringLoose(input, "uint8-le");
    case "utf-16be":
      return utf16fromStringLoose(input, "uint8-be");
    case "us-ascii":
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

// --- Internal helpers ---

function decodeASCII(bytes: Uint8Array): string {
  // 7-bit ASCII: mask high bit. (Kept to match your original semantics.)
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const end = Math.min(bytes.length, i + CHUNK);
    const codes = new Array<number>(end - i);
    for (let j = i, k = 0; j < end; j++, k++) {
      codes[k] = bytes[j] & 0x7f;
    }
    parts.push(String.fromCharCode.apply(null, codes as unknown as number[]));
  }
  return parts.join("");
}

function decodeLatin1(bytes: Uint8Array): string {
  // Latin-1 is 0x00..0xFF direct mapping; avoid spread.
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const end = Math.min(bytes.length, i + CHUNK);
    const codes = new Array<number>(end - i);
    for (let j = i, k = 0; j < end; j++, k++) {
      codes[k] = bytes[j];
    }
    parts.push(String.fromCharCode.apply(null, codes as unknown as number[]));
  }
  return parts.join("");
}

function decodeWindows1252(bytes: Uint8Array): string {
  // Only 0x80..0x9F need mapping; others are direct 1-byte codes.
  const parts: string[] = [];
  let out = "";

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    const extra = b >= 0x80 && b <= 0x9f ? WINDOWS_1252_EXTRA[b] : undefined;
    out += extra ?? String.fromCharCode(b);

    if (out.length >= CHUNK) {
      parts.push(out);
      out = "";
    }
  }

  if (out) parts.push(out);
  return parts.join("");
}

function encodeASCII(str: string): Uint8Array {
  // 7-bit ASCII: mask high bit
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0x7f;
  return out;
}

function encodeLatin1(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

function encodeWindows1252(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const code = ch.charCodeAt(0);

    if (code <= 0xff) {
      out[i] = code;
      continue;
    }
    const mapped = WINDOWS_1252_REVERSE[ch];
    out[i] = mapped !== undefined ? mapped : 0x3f; // '?'
  }
  return out;
}
