import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import type { RuntimeEnv } from "./env.js"

export type ImageStorage = {
  delete(key: string): Promise<void>
  head(key: string): Promise<{
    cacheControl?: string
    contentLength?: number
    contentType?: string
    etag?: string
    metadata?: Record<string, string>
  }>
  put(key: string, body: Uint8Array): Promise<void>
}
export type CoverStorage = ImageStorage
export type MediaStorage = ImageStorage
export type ChapterStorage = ImageStorage & {
  copyToPublic(
    sourceKey: string,
    targetKey: string,
    sha256: string,
    sourceEtag?: string
  ): Promise<void>
  deletePublic(key: string): Promise<void>
  headPublic(key: string): ReturnType<ImageStorage["head"]>
  previewUrl(key: string, expiresIn: number): Promise<string>
}

const requestOptions = () => ({ abortSignal: AbortSignal.timeout(60_000) })

function bucketStorage(
  client: S3Client,
  bucket: string,
  cacheControl?: string
): ImageStorage {
  return {
    async put(key, body) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: "image/webp",
          ...(cacheControl ? { CacheControl: cacheControl } : {}),
        }),
        requestOptions()
      )
    },
    async head(key) {
      const result = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
        requestOptions()
      )
      return {
        cacheControl: result.CacheControl,
        contentLength: result.ContentLength,
        contentType: result.ContentType,
        etag: result.ETag,
        metadata: result.Metadata,
      }
    },
    async delete(key) {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key }),
        requestOptions()
      )
    },
  }
}

function chapterBucketStorage(
  client: S3Client,
  stagingBucket: string,
  publicBucket: string
): ChapterStorage {
  const staging = bucketStorage(client, stagingBucket)
  const publicStorage = bucketStorage(
    client,
    publicBucket,
    "public, max-age=31536000, immutable"
  )
  return {
    ...staging,
    async copyToPublic(sourceKey, targetKey, sha256, sourceEtag) {
      const copySource = `${stagingBucket}/${sourceKey
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`
      await client.send(
        new CopyObjectCommand({
          Bucket: publicBucket,
          Key: targetKey,
          CopySource: copySource,
          ...(sourceEtag ? { CopySourceIfMatch: sourceEtag } : {}),
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
          Metadata: { sha256 },
          MetadataDirective: "REPLACE",
        }),
        requestOptions()
      )
    },
    deletePublic: publicStorage.delete,
    headPublic: publicStorage.head,
    previewUrl(key, expiresIn) {
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: stagingBucket, Key: key }),
        { expiresIn }
      )
    },
  }
}

export function createStorages(env: RuntimeEnv): {
  chapterStorage?: ChapterStorage
  coverStorage?: CoverStorage
} {
  if (!env.S3_STAGING_BUCKET) return {}
  const client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
  })
  return {
    coverStorage: bucketStorage(
      client,
      env.S3_BUCKET!,
      "public, max-age=31536000, immutable"
    ),
    chapterStorage: chapterBucketStorage(
      client,
      env.S3_STAGING_BUCKET,
      env.S3_BUCKET!
    ),
  }
}

export function createCoverStorage(env: RuntimeEnv) {
  return createStorages(env).coverStorage
}

export function createChapterStorage(env: RuntimeEnv) {
  return createStorages(env).chapterStorage
}
