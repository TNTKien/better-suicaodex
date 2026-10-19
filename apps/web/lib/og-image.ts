export function getMangaOgImageUrl(id: string) {
  return getOgImageUrl("manga", id)
}

export function getGroupOgImageUrl(id: string) {
  return getOgImageUrl("group", id)
}

function getOgImageUrl(resource: "manga" | "group", id: string) {
  const origin = new URL(process.env.OG_IMAGE_URL ?? "http://localhost:3003")
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error(
      "OG_IMAGE_URL must be an HTTP(S) origin without credentials"
    )
  }
  return new URL(`/og-image/${resource}/${encodeURIComponent(id)}.png`, origin)
    .href
}
