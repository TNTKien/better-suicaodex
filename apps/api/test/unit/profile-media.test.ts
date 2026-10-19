import { describe, expect, test } from "bun:test"
import sharp from "sharp"

import {
  ownedProfileMediaKey,
  ProfileMediaError,
  profileMediaKey,
  profileMediaUrl,
  transformProfileMedia,
} from "../../src/shared/profile-media"

async function source() {
  return sharp({
    create: {
      width: 900,
      height: 1200,
      channels: 3,
      background: { r: 20, g: 120, b: 220 },
    },
  })
    .png()
    .toBuffer()
}

describe("profile media", () => {
  test("normalizes avatar and banner to fixed WebP dimensions", async () => {
    const input = new Uint8Array(await source())
    const avatar = await transformProfileMedia(input, "user-avatar")
    const banner = await transformProfileMedia(input, "group-banner")

    expect(await sharp(avatar).metadata()).toMatchObject({
      format: "webp",
      width: 512,
      height: 512,
    })
    expect(await sharp(banner).metadata()).toMatchObject({
      format: "webp",
      width: 1500,
      height: 500,
    })
  })

  test("rejects invalid input and only resolves owned immutable keys", async () => {
    expect(
      transformProfileMedia(new Uint8Array([1, 2, 3]), "user-avatar")
    ).rejects.toBeInstanceOf(ProfileMediaError)

    const ownerId = "user-1"
    const key = profileMediaKey(
      "user-avatar",
      ownerId,
      "018fdbd8-7e7c-7a25-9f13-e0fb32cfa856"
    )
    const url = profileMediaUrl("https://assets.example/base/", key)
    expect(
      ownedProfileMediaKey(
        url,
        "https://assets.example/base/",
        `users/${ownerId}/avatars/`
      )
    ).toBe(key)
    expect(
      ownedProfileMediaKey(
        "https://provider.example/avatar.webp",
        "https://assets.example/base/",
        `users/${ownerId}/avatars/`
      )
    ).toBeNull()
    expect(
      ownedProfileMediaKey(
        url,
        "https://assets.example/base/",
        "users/someone-else/avatars/"
      )
    ).toBeNull()
  })
})
