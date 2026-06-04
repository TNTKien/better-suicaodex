import assert from "node:assert/strict";
import { createCipheriv, createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  decodeImgxToWebp,
  isImgxUrl,
  unwrapImgxGrantDecodeKey,
  type ImgxGrant,
} from "@/lib/moetruyen/imgx";

const IMGX_HEADER_BYTES = 13;
const IMGX_V3_NONCE_BYTES = 12;
const IMGX_V3_AUTH_TAG_BYTES = 16;

const base64UrlEncode = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString("base64url");

const sha256Base64Url = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("base64url");

const stringToUtf8Bytes = (value: string) => new TextEncoder().encode(value);

const nextXorShift32 = (value: number) => {
  let x = value >>> 0;
  x ^= (x << 13) >>> 0;
  x ^= x >>> 17;
  x ^= (x << 5) >>> 0;
  return x >>> 0;
};

const seedFromKey = (key: Uint8Array) => {
  const seed = new DataView(
    key.buffer,
    key.byteOffset,
    key.byteLength,
  ).getUint32(0, false);
  return seed || 0x9e3779b9;
};

const shuffleBytesInPlace = (bytes: Uint8Array, key: Uint8Array) => {
  let seed = seedFromKey(key);

  for (let index = bytes.byteLength - 1; index > 0; index -= 1) {
    seed = nextXorShift32(seed);
    const swapWith = seed % (index + 1);
    const value = bytes[index] ?? 0;
    bytes[index] = bytes[swapWith] ?? 0;
    bytes[swapWith] = value;
  }
};

const xorInPlace = (bytes: Uint8Array, key: Uint8Array) => {
  for (let index = 0; index < bytes.byteLength; index += 1) {
    bytes[index] = (bytes[index] ?? 0) ^ (key[index % key.byteLength] ?? 0);
  }
};

const fnv1a32 = (bytes: Uint8Array) => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < bytes.byteLength; index += 1) {
    hash ^= bytes[index] ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash || 0x9e3779b9;
};

const createGrantKeyMask = (material: string, byteLength = 32) => {
  const mask = new Uint8Array(byteLength);
  let seed = fnv1a32(stringToUtf8Bytes(material));

  for (let index = 0; index < byteLength; index += 1) {
    if (index % 4 === 0) {
      seed = nextXorShift32((seed + index + 0x9e3779b9) >>> 0);
    }

    mask[index] = (seed >>> ((index % 4) * 8)) & 0xff;
  }

  return mask;
};

const createGrantKeyWrapMaterial = (
  grant: Omit<ImgxGrant, "wrappedDecodeKey" | "wrappedContentKey">,
  storageKey: string,
) =>
  [
    "IMGX-GRANT-WRAP-v1",
    grant.version,
    grant.algorithm,
    grant.imageId,
    grant.issuedAt,
    grant.expiresAt,
    grant.nonce,
    grant.keyNonce,
    grant.signature,
    storageKey.trim().replace(/^\/+/, ""),
  ].join(".");

const createWrappedGrant = (
  decodeKey: Uint8Array,
  storageKey: string,
  contentKey = Uint8Array.from({ length: 32 }, (_, index) => 255 - index),
): ImgxGrant => {
  const grantWithoutKey = {
    version: 1,
    algorithm: "IMGX-GRANT-WRAP-v1",
    codecVersions: [2, 3],
    defaultCodecVersion: 3,
    contentAlgorithm: "IMGX-AES-256-GCM-HKDF-v3",
    legacyAlgorithm: "IMGX-HMAC-SHA256-v2",
    imageId: "test-image-id",
    issuedAt: 1_779_440_000_000,
    expiresAt: 1_779_440_060_000,
    nonce: "nonce",
    keyNonce: "key-nonce",
    keyHash: sha256Base64Url(decodeKey),
    contentKeyHash: sha256Base64Url(contentKey),
    signature: "signature",
  } satisfies Omit<ImgxGrant, "wrappedDecodeKey" | "wrappedContentKey">;
  const mask = createGrantKeyMask(
    createGrantKeyWrapMaterial(grantWithoutKey, storageKey),
    decodeKey.byteLength,
  );
  const wrappedDecodeKey = Uint8Array.from(decodeKey);
  const wrappedContentKey = Uint8Array.from(contentKey);
  xorInPlace(wrappedDecodeKey, mask);
  xorInPlace(wrappedContentKey, mask);

  return {
    ...grantWithoutKey,
    wrappedDecodeKey: base64UrlEncode(wrappedDecodeKey),
    wrappedContentKey: base64UrlEncode(wrappedContentKey),
  };
};

const createImgxBinary = (webp: Uint8Array, key: Uint8Array) => {
  const header = new Uint8Array(IMGX_HEADER_BYTES);
  header.set([0x49, 0x4d, 0x47, 0x58], 0);
  header[4] = 2;
  const headerView = new DataView(header.buffer);
  headerView.setUint32(5, 640, false);
  headerView.setUint32(9, 960, false);

  const payload = Uint8Array.from(webp);
  xorInPlace(payload, key);
  shuffleBytesInPlace(payload, key);

  const binary = new Uint8Array(header.byteLength + payload.byteLength);
  binary.set(header, 0);
  binary.set(payload, header.byteLength);

  return binary;
};

const createImgxV3Binary = (
  webp: Uint8Array,
  contentKey: Uint8Array,
  grant: ImgxGrant,
  storageKey: string,
) => {
  const width = 640;
  const height = 960;
  const header = new Uint8Array(IMGX_HEADER_BYTES);
  header.set([0x49, 0x4d, 0x47, 0x58], 0);
  header[4] = 3;
  const headerView = new DataView(header.buffer);
  headerView.setUint32(5, width, false);
  headerView.setUint32(9, height, false);

  const nonce = Buffer.alloc(IMGX_V3_NONCE_BYTES, 0xcd);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(contentKey), nonce);
  cipher.setAAD(
    Buffer.from(
      [
        "IMGX-v3",
        grant.imageId,
        storageKey.trim().replace(/^\/+/, ""),
        width,
        height,
      ].join("."),
      "utf8",
    ),
  );
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(webp)),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  assert.equal(tag.byteLength, IMGX_V3_AUTH_TAG_BYTES);

  const binary = new Uint8Array(
    header.byteLength +
      nonce.byteLength +
      ciphertext.byteLength +
      tag.byteLength,
  );
  binary.set(header, 0);
  binary.set(nonce, header.byteLength);
  binary.set(ciphertext, header.byteLength + nonce.byteLength);
  binary.set(tag, header.byteLength + nonce.byteLength + ciphertext.byteLength);

  return binary;
};

void describe("MoeTruyen IMGX decoder", () => {
  void it("detects IMGX page URLs", () => {
    assert.equal(isImgxUrl("https://i.truyen.moe/001.js?t=1"), true);
    assert.equal(isImgxUrl("https://i.truyen.moe/001.bin"), true);
    assert.equal(isImgxUrl("https://i.truyen.moe/001.webp"), false);
  });

  void it("unwraps page grants and decodes IMGX payloads into WebP bytes", async () => {
    const storageKey = "chapters/manga-873/ch-52/001_ysXot.js";
    const decodeKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
    const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4]);
    const grant = createWrappedGrant(decodeKey, storageKey);
    const binary = createImgxBinary(webp, decodeKey);

    assert.deepEqual(
      await unwrapImgxGrantDecodeKey(grant, storageKey),
      decodeKey,
    );
    assert.deepEqual(await decodeImgxToWebp(binary, grant, storageKey), {
      width: 640,
      height: 960,
      webp,
    });
  });

  void it("unwraps content grants and decodes IMGX v3 AES-GCM payloads", async () => {
    const storageKey = "chapters/manga-873/ch-52/001_ysXot.js";
    const decodeKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
    const contentKey = Uint8Array.from(
      { length: 32 },
      (_, index) => index + 33,
    );
    const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 9, 8, 7, 6]);
    const grant = createWrappedGrant(decodeKey, storageKey, contentKey);
    const binary = createImgxV3Binary(webp, contentKey, grant, storageKey);

    assert.deepEqual(await decodeImgxToWebp(binary, grant, storageKey), {
      width: 640,
      height: 960,
      webp,
    });
  });

  void it("rejects grants wrapped for another storage key", async () => {
    const grant = createWrappedGrant(new Uint8Array(32).fill(7), "a/001.js");

    await assert.rejects(
      unwrapImgxGrantDecodeKey(grant, "a/002.js"),
      /IMGX wrapped decode key hash mismatch/,
    );
  });
});
