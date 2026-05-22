import type { PostV2ChaptersByIdPageAccess200DataPagesItemGrant } from "./model/postV2ChaptersByIdPageAccess200DataPagesItemGrant";

const IMGX_HEADER_BYTES = 13;
const IMGX_KEY_BYTES = 32;
const IMGX_MAGIC = [0x49, 0x4d, 0x47, 0x58] as const;
const IMGX_VERSION = 2;

export type ImgxGrant = PostV2ChaptersByIdPageAccess200DataPagesItemGrant;

export interface DecodedImgxPage {
  width: number;
  height: number;
  webp: Uint8Array;
}

const textEncoder = new TextEncoder();

export function isImgxUrl(value: string): boolean {
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    return pathname.endsWith(".js") || pathname.endsWith(".bin");
  } catch {
    const source = value.split(/[?#]/, 1)[0]?.toLowerCase() ?? "";
    return source.endsWith(".js") || source.endsWith(".bin");
  }
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

async function sha256Base64Url(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytesToArrayBuffer(bytes),
  );
  return bytesToBase64Url(new Uint8Array(digest));
}

function normalizeStorageKey(storageKey: string): string {
  return storageKey.trim().replace(/^\/+/, "");
}

function nextXorShift32(value: number): number {
  let x = value >>> 0;
  x ^= (x << 13) >>> 0;
  x ^= x >>> 17;
  x ^= (x << 5) >>> 0;
  return x >>> 0;
}

function fnv1a32(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < bytes.byteLength; index += 1) {
    hash ^= bytes[index] ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash || 0x9e3779b9;
}

function seedFromKey(key: Uint8Array): number {
  if (key.byteLength < 4) {
    throw new Error("IMGX key invalid");
  }

  const seed = new DataView(
    key.buffer,
    key.byteOffset,
    key.byteLength,
  ).getUint32(0, false);
  return seed || 0x9e3779b9;
}

function createGrantKeyWrapMaterial(
  grant: Omit<ImgxGrant, "wrappedDecodeKey">,
  storageKey: string,
): string {
  return [
    "IMGX-GRANT-WRAP-v1",
    grant.version,
    grant.algorithm,
    grant.imageId,
    grant.issuedAt,
    grant.expiresAt,
    grant.nonce,
    grant.keyNonce,
    grant.signature,
    normalizeStorageKey(storageKey),
  ].join(".");
}

function createGrantKeyMask(material: string, byteLength = IMGX_KEY_BYTES) {
  const mask = new Uint8Array(byteLength);
  let seed = fnv1a32(textEncoder.encode(material));

  for (let index = 0; index < byteLength; index += 1) {
    if (index % 4 === 0) {
      seed = nextXorShift32((seed + index + 0x9e3779b9) >>> 0);
    }

    mask[index] = (seed >>> ((index % 4) * 8)) & 0xff;
  }

  return mask;
}

function swapByte(bytes: Uint8Array, left: number, right: number) {
  if (left === right) return;

  const tmp = bytes[left] ?? 0;
  bytes[left] = bytes[right] ?? 0;
  bytes[right] = tmp;
}

function unshuffleBytesInPlace(bytes: Uint8Array, key: Uint8Array) {
  const swaps = new Uint32Array(bytes.byteLength);
  let seed = seedFromKey(key);

  for (let index = bytes.byteLength - 1; index > 0; index -= 1) {
    seed = nextXorShift32(seed);
    swaps[index] = seed % (index + 1);
  }

  for (let index = 1; index < bytes.byteLength; index += 1) {
    swapByte(bytes, index, swaps[index] ?? 0);
  }
}

function xorBytesInPlace(bytes: Uint8Array, key: Uint8Array) {
  if (key.byteLength === 0) {
    throw new Error("IMGX key missing");
  }

  for (let index = 0; index < bytes.byteLength; index += 1) {
    bytes[index] = (bytes[index] ?? 0) ^ (key[index % key.byteLength] ?? 0);
  }
}

function parseImgxHeader(binary: Uint8Array) {
  if (binary.byteLength <= IMGX_HEADER_BYTES) {
    throw new Error("IMGX payload empty");
  }

  for (let index = 0; index < IMGX_MAGIC.length; index += 1) {
    if (binary[index] !== IMGX_MAGIC[index]) {
      throw new Error("IMGX magic invalid");
    }
  }

  if (binary[4] !== IMGX_VERSION) {
    throw new Error("IMGX version invalid");
  }

  const view = new DataView(
    binary.buffer,
    binary.byteOffset,
    binary.byteLength,
  );
  const width = view.getUint32(5, false);
  const height = view.getUint32(9, false);

  if (width <= 0 || height <= 0) {
    throw new Error("IMGX dimensions invalid");
  }

  return { width, height };
}

export async function unwrapImgxGrantDecodeKey(
  grant: ImgxGrant,
  storageKey: string,
): Promise<Uint8Array> {
  const wrapped = base64UrlToBytes(grant.wrappedDecodeKey);

  if (wrapped.byteLength !== IMGX_KEY_BYTES) {
    throw new Error("IMGX wrapped grant invalid");
  }

  const mask = createGrantKeyMask(
    createGrantKeyWrapMaterial(grant, storageKey),
    wrapped.byteLength,
  );
  xorBytesInPlace(wrapped, mask);

  if ((await sha256Base64Url(wrapped)) !== grant.keyHash) {
    throw new Error("IMGX wrapped decode key hash mismatch");
  }

  return wrapped;
}

export async function decodeImgxToWebp(
  source: ArrayBuffer | Uint8Array,
  grant: ImgxGrant,
  storageKey: string,
): Promise<DecodedImgxPage> {
  const binary = source instanceof Uint8Array ? source : new Uint8Array(source);
  const header = parseImgxHeader(binary);
  const decodeKey = await unwrapImgxGrantDecodeKey(grant, storageKey);
  const payload = binary.slice(IMGX_HEADER_BYTES);

  unshuffleBytesInPlace(payload, decodeKey);
  xorBytesInPlace(payload, decodeKey);

  return {
    ...header,
    webp: payload,
  };
}
