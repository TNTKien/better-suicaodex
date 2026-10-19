import {
  createLoader,
  createParser,
  createSerializer,
  parseAsStringLiteral,
} from "nuqs/server"

const chapterDirections = ["asc", "desc"] as const
const mangaTabs = ["chapters", "comments", "recommendations"] as const

export type ChapterDirection = (typeof chapterDirections)[number]
export type MangaTab = (typeof mangaTabs)[number]

export const positiveIntegerParser = createParser({
  parse(value) {
    const number = Number(value)
    return Number.isSafeInteger(number) && number > 0 ? number : null
  },
  serialize: String,
})

export const mangaTabParser = parseAsStringLiteral(mangaTabs)
  .withDefault("chapters")
  .withOptions({ history: "push" })

export const mangaSearchParams = {
  page: positiveIntegerParser.withDefault(1),
  direction: parseAsStringLiteral(chapterDirections).withDefault("desc"),
  tab: mangaTabParser,
}

export const loadMangaSearchParams = createLoader(mangaSearchParams)
const serializeMangaSearchParams = createSerializer(mangaSearchParams)

export function mangaDetailHref(
  manga: { id: string; slug: string },
  searchParams: Partial<{
    direction: ChapterDirection
    page: number
    tab: MangaTab
  }> = {}
) {
  const path = `/manga/${manga.id}/${manga.slug}`
  return serializeMangaSearchParams(path, searchParams)
}

export function chapterListHref(
  manga: { id: string; slug: string },
  page: number,
  direction: ChapterDirection
) {
  return mangaDetailHref(manga, { direction, page })
}
