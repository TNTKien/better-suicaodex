const stickerFiles = {
  "Blue Archive": [
    "ba-hoshino-xamloz.webp",
    "ba-koharu.webp",
    "ba-shiroko.webp",
  ],
  "Bocchi The Rock": [
    "bocchi-kita.webp",
    "bocchi-nijikagay.webp",
    "bocchi-rto.webp",
    "bocchi-shake.gif",
  ],
  Doro: [
    "doro-cinema.webp",
    "doro-dance.webp",
    "doro-fire.gif",
    "doro-hard.gif",
    "doro-origin.webp",
    "doro-shock.webp",
    "doro-think.gif",
  ],
  HoYoverse: [
    "hi3-bronya.webp",
    "hsr-danheng.gif",
    "hsr-hanbi.webp",
    "zzz-boo.gif",
  ],
  "Princess Connect! Re:Dive": [
    "kyaru-cafe.png",
    "kyaru-suc.gif",
    "kyaru-tail.gif",
    "kyaru-uhm.webp",
    "kyaru-vuong.webp",
  ],
  Khác: [
    "cunny.gif",
    "gay.webp",
    "lau-chat.gif",
    "mau.webp",
    "meo-xamloz.webp",
    "nikke-shifty.gif",
    "pepe-sieu-long.webp",
    "woman.webp",
  ],
} as const

const categoryPaths = [
  "bluearchive",
  "bocchi",
  "doro",
  "michos",
  "princonne",
  "others",
] as const

export const stickerCategories = Object.entries(stickerFiles).map(
  ([label, files], index) => ({
    id: categoryPaths[index]!,
    label,
    stickers: files.map((file) => ({
      name: file.replace(/\.[^.]+$/, ""),
      url: `/images/stickers/${categoryPaths[index]}/${file}`,
    })),
  })
)

export const stickers = stickerCategories.flatMap(({ stickers }) => stickers)
export const stickerByName = new Map(
  stickers.map((sticker) => [sticker.name, sticker])
)

const stickerPattern = /:([a-z0-9-]+):/gi
export function parseCommentBody(body: string) {
  const stickerNames = [...body.matchAll(stickerPattern)]
    .map((match) => match[1]?.toLowerCase())
    .filter((name): name is string => Boolean(name && stickerByName.has(name)))
  const text = body
    .replace(stickerPattern, (token, name: string) =>
      stickerByName.has(name.toLowerCase()) ? "" : token
    )
    .trim()
  return { text, stickerNames }
}
