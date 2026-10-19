import assert from "node:assert/strict"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
const feedback: { type: string; title: string }[] = []
mock.module("@workspace/ui/components/toast", () => ({
  toast: {
    add: (message: (typeof feedback)[number]) => feedback.push(message),
  },
}))
const originalFetch = globalThis.fetch
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
const originalNavigator = Object.getOwnPropertyDescriptor(
  globalThis,
  "navigator"
)
const { MangaChapterHeader } =
  await import("../modules/manga/manga-chapter-header")
const { CopyMangaLink } = await import("../modules/manga/copy-manga-link")
const manga = {
  id: "manga-id",
  slug: "manga-slug",
  statistics: { views: 0, follows: 1234, comments: 5 },
  groups: [
    {
      id: "first-group",
      name: "Nhóm đầu <script>",
      slug: "first-group",
      avatarUrl: "https://images.example.test/group.webp",
    },
    {
      id: "second-group",
      name: "Nhóm thứ hai",
      slug: "second-group",
      avatarUrl: "https://images.example.test/second-group.webp",
    },
  ],
}
try {
  const requested: string[] = []
  globalThis.fetch = (async (input) => {
    requested.push(String(input))
    throw new Error("Chapter header must use manga data without fetching")
  }) as typeof fetch
  const html = renderToStaticMarkup(MangaChapterHeader({ manga }))
  assert.match(html, /DANH SÁCH CHƯƠNG/)
  assert.match(html, /Nhóm dịch:/)
  assert.match(html, /Nhóm đầu &lt;script&gt;/)
  assert.match(html, /href="\/group\/first-group\/first-group"/)
  assert.match(html, /src="https:\/\/images\.example\.test\/group.webp"/)
  assert.match(html, /src="\/brand\/chuthot.webp"[^>]*\/>Chủ thớt<\/p>/)
  assert.doesNotMatch(html, /uploader.webp|Uploader/)
  assert.match(html, /Copy link truyện/)
  assert.match(html, /src="\/brand\/like.webp"[^>]*\/><span>1\.234<\/span>/)
  assert.match(html, /src="\/brand\/dis.webp"[^>]*\/><span>5<\/span>/)
  assert.doesNotMatch(
    html,
    /Nhóm thứ hai|Đăng bởi|Phó nhóm|Like|Dislike|Copy ID|<input|href="\/chapter\//
  )
  assert.match(
    renderToStaticMarkup(
      MangaChapterHeader({
        manga: {
          ...manga,
          groups: [{ ...manga.groups[0]!, avatarUrl: null }],
        },
      })
    ),
    /src="\/brand\/mac_dinh.webp"/
  )
  const noGroup = renderToStaticMarkup(
    MangaChapterHeader({ manga: { ...manga, groups: [] } })
  )
  assert.match(noGroup, /Chưa có nhóm dịch/)
  assert.match(noGroup, /Copy link truyện/)
  assert.doesNotMatch(noGroup, /chuthot.webp|uploader.webp|Chủ thớt|Uploader/)
  const systemGroup = renderToStaticMarkup(
    MangaChapterHeader({
      manga: {
        ...manga,
        groups: [{ ...manga.groups[0]!, name: "System", slug: "system" }],
      },
    })
  )
  assert.match(systemGroup, /src="\/brand\/uploader.webp"[^>]*\/>Uploader<\/p>/)
  assert.doesNotMatch(systemGroup, /chuthot.webp|Chủ thớt/)
  const zeroCounts = renderToStaticMarkup(
    MangaChapterHeader({
      manga: { ...manga, statistics: { views: 0, follows: 0, comments: 0 } },
    })
  )
  assert.match(zeroCounts, /src="\/brand\/like.webp"[^>]*\/><\/span>/)
  assert.match(zeroCounts, /src="\/brand\/dis.webp"[^>]*\/><\/span>/)
  const noFollowers = renderToStaticMarkup(
    MangaChapterHeader({
      manga: { ...manga, statistics: { ...manga.statistics, follows: 0 } },
    })
  )
  assert.match(noFollowers, /src="\/brand\/like.webp"[^>]*\/><\/span>/)
  assert.match(noFollowers, /src="\/brand\/dis.webp"[^>]*\/><span>5<\/span>/)
  assert.equal(requested.length, 0)

  const copied: string[] = []
  let denied = false
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        origin: "https://new-ui.example.test",
        href: "https://new-ui.example.test/manga/manga-id/manga-slug?page=2#chapters",
      },
    },
  })
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      clipboard: {
        writeText: async (value: string) => {
          if (denied) throw new Error("denied")
          copied.push(value)
        },
      },
    },
  })
  const button = CopyMangaLink({ path: "/manga/manga-id/manga-slug" })
  const click = button.props.onClick as () => Promise<void>
  await click()
  assert.deepEqual(copied, [
    "https://new-ui.example.test/manga/manga-id/manga-slug",
  ])
  assert.equal(feedback.at(-1)?.type, "success")
  denied = true
  await click()
  assert.equal(feedback.at(-1)?.type, "error")
  assert.equal(copied.length, 1)
} finally {
  globalThis.fetch = originalFetch
  for (const [key, descriptor] of [
    ["window", originalWindow],
    ["navigator", originalNavigator],
  ] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
}
console.log(
  "HVN first group, avatar fallback, follow/comment counters and canonical manga link clipboard checks passed"
)
