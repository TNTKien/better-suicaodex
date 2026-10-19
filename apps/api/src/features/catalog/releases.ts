import type { ChapterSummary } from "./contract.js"

export type ChapterRelease = ChapterSummary & {
  readingKey: string
  laneGroupIds: string[]
}

const navigationItem = (r: ChapterSummary) => ({
  id: r.id,
  number: r.number,
  volume: r.volume,
  title: r.title,
  language: r.language,
  groups: r.groups,
})

export function chapterSlots(
  rows: readonly ChapterRelease[],
  mode: "global" | "volume",
  singleUnnumberedLanguages: ReadonlySet<string> = new Set()
) {
  const slots = new Map<string, ChapterRelease[]>()
  // PostgreSQL orders slots numerically and variants by exact timestamp/UUID.
  // Keep that order: serialized timestamps may have less precision than the DB.
  for (const row of rows) {
    const key = JSON.stringify([row.language, row.readingKey])
    const slot = slots.get(key)
    if (slot) slot.push(row)
    else slots.set(key, [row])
  }
  return [...slots.values()].map((releases) => {
    const first = releases[0]!
    const defaults = releases.filter((r) => r.isDefault)
    const defaultChapterId =
      defaults.length === 1
        ? defaults[0]!.id
        : releases.length === 1
          ? first.id
          : null
    return {
      key: first.readingKey,
      language: first.language,
      number: first.number,
      volume: mode === "volume" ? first.volume : null,
      automaticOrder:
        first.number === null
          ? singleUnnumberedLanguages.has(first.language)
          : mode === "global" || first.volume !== null,
      defaultChapterId,
      releases: [...releases]
        .sort(
          (a, b) =>
            Number(b.id === defaultChapterId) -
            Number(a.id === defaultChapterId)
        )
        .map(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Do not expose raw lane identifiers.
          ({ readingKey: _key, laneGroupIds: _lane, ...release }) => release
        ),
    }
  })
}

export type ChapterSlot = ReturnType<typeof chapterSlots>[number]
export const boundaryChoice = () => ({
  state: "boundary" as const,
  selectedChapterId: null,
  options: [],
})

export function chapterEntry(slot: ChapterSlot | undefined) {
  if (!slot) return boundaryChoice()
  return {
    state: slot.defaultChapterId
      ? ("ready" as const)
      : ("choice-required" as const),
    selectedChapterId: slot.defaultChapterId,
    options: slot.releases.map(navigationItem),
  }
}

export function mangaReadingEntries(
  rows: readonly ChapterRelease[],
  mode: "global" | "volume"
) {
  const languages = [...new Set(rows.map((r) => r.language))]
  return languages.map((language) => {
    const releases = rows.filter((r) => r.language === language)
    const slots = chapterSlots(
      releases,
      mode,
      releases.length === 1 ? new Set([language]) : new Set()
    )
    const ordered = slots.filter((s) => s.automaticOrder)
    const unordered = {
      state: "unordered" as const,
      selectedChapterId: null,
      options: slots.flatMap((s) => s.releases.map(navigationItem)),
    }
    return {
      language,
      first: ordered.length ? chapterEntry(ordered[0]) : unordered,
      last: ordered.length ? chapterEntry(ordered.at(-1)) : unordered,
    }
  })
}

export function chapterNavigation(
  rows: readonly ChapterRelease[],
  currentId: string,
  mode: "global" | "volume"
) {
  const current = rows.find((r) => r.id === currentId)!
  const sameLanguage = rows.filter((r) => r.language === current.language)
  const singles =
    sameLanguage.length === 1 && current.number === null
      ? new Set([current.language])
      : new Set<string>()
  const slots = chapterSlots(sameLanguage, mode, singles)
  const currentSlot = slots.find((s) =>
    s.releases.some((r) => r.id === currentId)
  )!
  const automatic = slots.filter((s) => s.automaticOrder)
  const index = automatic.findIndex((s) => s.key === currentSlot.key)
  const unordered = {
    state: "unordered" as const,
    selectedChapterId: null,
    options: [],
  }
  const groupKey = (r: ChapterRelease) =>
    JSON.stringify([...r.laneGroupIds].sort())
  const byId = new Map(rows.map((r) => [r.id, r]))
  const choice = (slot: ChapterSlot | undefined) => {
    if (!slot) return boundaryChoice()
    const lane = slot.releases.filter(
      (r) => groupKey(byId.get(r.id)!) === groupKey(current)
    )
    const preferred = lane.filter((r) => r.isDefault)
    const selected =
      lane.length === 1
        ? lane[0]
        : preferred.length === 1
          ? preferred[0]
          : undefined
    return {
      state: selected ? ("ready" as const) : ("choice-required" as const),
      selectedChapterId: selected?.id ?? null,
      options: slot.releases.map(navigationItem),
    }
  }
  return {
    previous: index === -1 ? unordered : choice(automatic[index - 1]),
    next: index === -1 ? unordered : choice(automatic[index + 1]),
    alternatives: currentSlot.releases
      .filter((r) => r.id !== currentId)
      .map(navigationItem),
  }
}
