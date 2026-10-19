import { expect, test, type Page } from "@playwright/test"

async function openFixtureManga(page: Page) {
  await page.goto("/")
  await page
    .getByRole("searchbox", { name: "Tìm kiếm nhanh manga" })
    .fill("Sample manga 1")
  await page
    .getByRole("region", { name: "Kết quả tìm kiếm nhanh" })
    .getByRole("link", { name: /Sample manga 1/ })
    .click()
  await expect(
    page.getByRole("heading", { name: "Sample manga 1" })
  ).toBeVisible()
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    )
    .toBe(true)
}

test("quick search, canonical redirects and manga tabs keep their URL state", async ({
  page,
}) => {
  await openFixtureManga(page)
  await expect(page).toHaveURL(/\/manga\/[0-9a-f-]+\/sample-manga-1$/)
  await expect(
    page.getByRole("tab", { name: "Danh sách chương" })
  ).toHaveAttribute("aria-selected", "true")

  await page.getByRole("tab", { name: "Có thể bạn sẽ thích" }).click()
  await expect(page).toHaveURL(/tab=recommendations/)
  await page.reload()
  await expect(
    page.getByRole("tab", { name: "Có thể bạn sẽ thích" })
  ).toHaveAttribute("aria-selected", "true")

  await page.goto("/manga/425b0671-b5f5-4b34-850b-4429d1e6286a")
  await expect(page).toHaveURL(/\/manga\/[0-9a-f-]+\/sample-manga-1$/)
})

test("advanced search survives reload and all baseline widths avoid page overflow", async ({
  page,
}) => {
  const widths = [360, 390, 639, 640, 768, 1440]
  const path =
    "/advanced-search?q=Sample+manga+1&status=completed&sort=title&direction=asc&hasChapter=true"

  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 640 ? 760 : 900 })
    await page.goto(path)
    await expect(
      page.getByRole("heading", { name: "Tìm kiếm nâng cao" })
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Sample manga 1" })
    ).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }

  await page.reload()
  await expect(page).toHaveURL(/q=Sample\+manga\+1/)
  await expect(page).toHaveURL(/direction=asc/)
})

test("theme, sidebar and quick-search keyboard behavior remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  const theme = page.getByRole("button", {
    name: "Chuyển đổi giao diện sáng/tối",
  })
  const wasDark = await page
    .locator("html")
    .evaluate((element) => element.classList.contains("dark"))
  await theme.click()
  await expect
    .poll(() =>
      page
        .locator("html")
        .evaluate((element) => element.classList.contains("dark"))
    )
    .toBe(!wasDark)

  const search = page.getByRole("searchbox", { name: "Tìm kiếm nhanh manga" })
  await search.focus()
  await search.fill("Sample manga 1")
  await expect(
    page.getByRole("region", { name: "Kết quả tìm kiếm nhanh" })
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(
    page.getByRole("region", { name: "Kết quả tìm kiếm nhanh" })
  ).toBeHidden()

  await page.getByRole("button", { name: "Mở hoặc thu gọn sidebar" }).click()
  await expectNoHorizontalOverflow(page)
})

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" })

  test("is exposed to the application", async ({ page }) => {
    await page.goto("/")
    await expect
      .poll(() =>
        page.evaluate(
          () => matchMedia("(prefers-reduced-motion: reduce)").matches
        )
      )
      .toBe(true)
  })
})
