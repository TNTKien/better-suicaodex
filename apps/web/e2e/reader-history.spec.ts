import { expect, test } from "@playwright/test"

test("guest reader supports both modes and keeps chapter history locally", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/manga/425b0671-b5f5-4b34-850b-4429d1e6286a")
  const chapterHref = await page
    .getByRole("link", { name: "Đọc mới nhất" })
    .getAttribute("href")
  expect(chapterHref).toMatch(/^\/chapter\//)
  await page.goto(chapterHref!)

  await expect(
    page.getByRole("dialog", { name: "Chọn giao diện đọc" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Classic UI" }).last().click()
  await page.getByRole("button", { name: "Xác nhận" }).click()
  await expect(page.locator("[data-reader-page]").first()).toBeVisible()
  await expect(
    page.getByRole("navigation", { name: "Điều khiển reader" })
  ).toBeVisible()
  const controls = page
    .getByRole("navigation", { name: "Điều khiển reader" })
    .getByRole("button")
  for (const control of await controls.all()) {
    const box = await control.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }

  await page.getByRole("button", { name: /Ch\./ }).click()
  await expect(page.getByRole("dialog", { name: "Chọn chapter" })).toBeVisible()
  await expect(
    page.getByRole("heading", { name: /Volume|No Volume/ }).first()
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: "Chọn chapter" })).toBeHidden()

  await page.getByRole("button", { name: "Zen UI" }).click()
  await expect(page.locator("[data-zen-stage='intro']")).toBeVisible()
  await expect(page.getByRole("button", { name: "Trang tiếp" })).toBeVisible()

  await page.goto("/history")
  await expect(
    page.getByText("Lịch sử đang lưu trên thiết bị này")
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Xem Sample manga 1" })
  ).toBeVisible()
  const stored = await page.evaluate(() =>
    window.localStorage.getItem("redive:reading-history:v2")
  )
  expect(stored).toContain("Sample manga 1")
})

test("failed account sync cannot erase guest history", async ({ page }) => {
  await page.goto("/manga/425b0671-b5f5-4b34-850b-4429d1e6286a")
  const chapterHref = await page
    .getByRole("link", { name: "Đọc mới nhất" })
    .getAttribute("href")
  await page.route("**/v1/me/reading-history**", (route) => route.abort())
  await page.goto(chapterHref!)
  const dialog = page.getByRole("dialog", { name: "Chọn giao diện đọc" })
  if (await dialog.isVisible()) {
    await page.getByRole("button", { name: "Classic UI" }).last().click()
    await page.getByRole("button", { name: "Xác nhận" }).click()
  }
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem("redive:reading-history:v2")
      )
    )
    .toContain("Sample manga 1")
})
