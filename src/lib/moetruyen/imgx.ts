import type { PostV2ChaptersByIdPageAccess200DataPagesItemGrant } from "./model/postV2ChaptersByIdPageAccess200DataPagesItemGrant";

const IMGX_HEADER_BYTES = 13;
const IMGX_KEY_BYTES = 32;
const IMGX_MAGIC = [0x49, 0x4d, 0x47, 0x58] as const;
const IMGX_LEGACY_VERSION = 2;
const IMGX_VERSION = 3;
const IMGX_V3_NONCE_BYTES = 12;
const IMGX_V3_AUTH_TAG_BYTES = 16;

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
  grant: ImgxGrant,
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

  const version = Number(binary[4]) || 0;

  if (version !== IMGX_LEGACY_VERSION && version !== IMGX_VERSION) {
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

  return { version, width, height };
}

async function unwrapImgxGrantWrappedKey(
  grant: ImgxGrant,
  storageKey: string,
  fieldName: "wrappedDecodeKey" | "wrappedContentKey",
  hashFieldName: "keyHash" | "contentKeyHash",
  label: string,
): Promise<Uint8Array> {
  const wrapped = base64UrlToBytes(grant[fieldName]);

  if (wrapped.byteLength !== IMGX_KEY_BYTES) {
    throw new Error(`${label} invalid`);
  }

  const mask = createGrantKeyMask(
    createGrantKeyWrapMaterial(grant, storageKey),
    wrapped.byteLength,
  );
  xorBytesInPlace(wrapped, mask);

  if ((await sha256Base64Url(wrapped)) !== grant[hashFieldName]) {
    throw new Error(`${label} hash mismatch`);
  }

  return wrapped;
}

export async function unwrapImgxGrantDecodeKey(
  grant: ImgxGrant,
  storageKey: string,
): Promise<Uint8Array> {
  return unwrapImgxGrantWrappedKey(
    grant,
    storageKey,
    "wrappedDecodeKey",
    "keyHash",
    "IMGX wrapped decode key",
  );
}

export async function unwrapImgxGrantContentKey(
  grant: ImgxGrant,
  storageKey: string,
): Promise<Uint8Array> {
  return unwrapImgxGrantWrappedKey(
    grant,
    storageKey,
    "wrappedContentKey",
    "contentKeyHash",
    "IMGX wrapped content key",
  );
}

function createImgxV3AdditionalData(
  grant: ImgxGrant,
  storageKey: string,
  header: { width: number; height: number },
): Uint8Array {
  const imageId = grant.imageId.trim();

  if (!imageId) {
    throw new Error("IMGX v3 image id missing");
  }

  return textEncoder.encode(
    [
      "IMGX-v3",
      imageId,
      normalizeStorageKey(storageKey),
      Math.max(1, Math.floor(Number(header.width) || 0)),
      Math.max(1, Math.floor(Number(header.height) || 0)),
    ].join("."),
  );
}

async function decodeImgxV3ToWebp(
  binary: Uint8Array,
  grant: ImgxGrant,
  storageKey: string,
  header: { width: number; height: number },
): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("IMGX v3 requires WebCrypto");
  }

  if (
    binary.byteLength <=
    IMGX_HEADER_BYTES + IMGX_V3_NONCE_BYTES + IMGX_V3_AUTH_TAG_BYTES
  ) {
    throw new Error("IMGX v3 payload empty");
  }

  const contentKey = await unwrapImgxGrantContentKey(grant, storageKey);
  const nonce = binary.slice(
    IMGX_HEADER_BYTES,
    IMGX_HEADER_BYTES + IMGX_V3_NONCE_BYTES,
  );
  const encryptedWithTag = binary.slice(
    IMGX_HEADER_BYTES + IMGX_V3_NONCE_BYTES,
  );
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    bytesToArrayBuffer(contentKey),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const decrypted = await globalThis.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: bytesToArrayBuffer(nonce),
      additionalData: bytesToArrayBuffer(
        createImgxV3AdditionalData(grant, storageKey, header),
      ),
      tagLength: 128,
    },
    cryptoKey,
    bytesToArrayBuffer(encryptedWithTag),
  );

  return new Uint8Array(decrypted);
}

export async function decodeImgxToWebp(
  source: ArrayBuffer | Uint8Array,
  grant: ImgxGrant,
  storageKey: string,
): Promise<DecodedImgxPage> {
  const binary = source instanceof Uint8Array ? source : new Uint8Array(source);
  const header = parseImgxHeader(binary);

  if (header.version === IMGX_VERSION) {
    return {
      width: header.width,
      height: header.height,
      webp: await decodeImgxV3ToWebp(binary, grant, storageKey, header),
    };
  }

  const decodeKey = await unwrapImgxGrantDecodeKey(grant, storageKey);
  const webp = binary.slice(IMGX_HEADER_BYTES);

  unshuffleBytesInPlace(webp, decodeKey);
  xorBytesInPlace(webp, decodeKey);

  return {
    width: header.width,
    height: header.height,
    webp,
  };
}
