export function groupChaptersByVolume<T extends { volume: string | null }>(
  chapters: readonly T[]
) {
  const groups = new Map<string | null, T[]>()
  for (const chapter of chapters) {
    const group = groups.get(chapter.volume)
    if (group) group.push(chapter)
    else groups.set(chapter.volume, [chapter])
  }
  return [...groups].map(([volume, items]) => ({ volume, chapters: items }))
}
