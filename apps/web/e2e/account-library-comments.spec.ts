import { expect, test, type Page } from "@playwright/test"

const account = {
  email: "phase75e-browser@example.com",
  name: "Phase 7.5E Reader",
  password: "phase75e-browser-password",
}

const libraryButton = (page: Page, label: string) =>
  page.locator('button[aria-haspopup="menu"]').filter({ hasText: label })

async function authenticate(page: Page) {
  const signUp = await page.request.post(
    "http://localhost:3101/api/auth/sign-up/email",
    {
      data: account,
      headers: { Origin: "http://localhost:3100" },
    }
  )
  if (signUp.ok()) return
  const signIn = await page.request.post(
    "http://localhost:3101/api/auth/sign-in/email",
    {
      data: { email: account.email, password: account.password },
      headers: { Origin: "http://localhost:3100" },
    }
  )
  expect(signIn.ok()).toBe(true)
}

test.describe.serial("authenticated reader flows", () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page)
  })

  test("library mutations persist and a failed mutation preserves the last category", async ({
    page,
  }) => {
    await page.goto("/manga/425b0671-b5f5-4b34-850b-4429d1e6286a")
    const library = page.getByRole("button", { name: "Thêm vào thư viện" })
    await library.click()
    await page.getByRole("menuitemradio", { name: "Theo dõi" }).click()
    await expect(page.getByRole("button", { name: /Theo dõi/ })).toBeVisible()
    await page.reload()
    await libraryButton(page, "Theo dõi").click()
    await page.getByRole("menuitemradio", { name: "Đang đọc" }).click()
    await expect(page.getByRole("button", { name: /Đang đọc/ })).toBeVisible()

    await page.reload()
    await expect(libraryButton(page, "Đang đọc")).toBeVisible()
    await page.evaluate(() => {
      const originalFetch = window.fetch
      window.fetch = (input, init) => {
        const url = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input
              : input.url,
          window.location.href
        )
        return init?.method === "PUT" &&
          url.pathname.startsWith("/v1/me/library/")
          ? Promise.resolve(new Response("{}", { status: 503 }))
          : originalFetch(input, init)
      }
    })
    await libraryButton(page, "Đang đọc").click()
    await page.getByRole("menuitemradio", { name: "Sẽ đọc" }).click()
    await expect(
      page.getByText("Không thể cập nhật thư viện. Vui lòng thử lại.")
    ).toBeVisible()
    await expect(page.getByRole("button", { name: /Đang đọc/ })).toBeVisible()
    await page.reload()
    await libraryButton(page, "Đang đọc").click()
    await page.getByRole("menuitem", { name: "Xóa khỏi thư viện" }).click()
    await expect(
      page.getByRole("button", { name: "Thêm vào thư viện" })
    ).toBeVisible()
  })

  test("comment draft survives failure, then create, reply, edit and tombstone work", async ({
    page,
  }) => {
    await page.goto("/manga/425b0671-b5f5-4b34-850b-4429d1e6286a?tab=comments")
    const composer = page.getByRole("textbox", { name: "Viết bình luận" })
    await expect(composer).toBeVisible()
    await page.route("**/v1/manga/*/comments", async (route) => {
      if (route.request().method() === "POST")
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "Lỗi kiểm thử" } }),
        })
      else await route.continue()
    })
    await composer.fill("Bản nháp không được mất 😺")
    await page.getByRole("button", { name: "Gửi bình luận" }).click()
    await expect(page.getByText("Lỗi kiểm thử")).toBeVisible()
    await expect(composer).toHaveValue("Bản nháp không được mất 😺")
    await page.unroute("**/v1/manga/*/comments")

    await composer.fill("Bình luận E2E 😺")
    await page.getByRole("button", { name: "Gửi bình luận" }).click()
    const root = page
      .locator("article")
      .filter({
        has: page.getByRole("link", {
          name: "Trang cá nhân của Phase 7.5E Reader",
        }),
      })
      .nth(1)
    await expect(root).toBeVisible()
    await root.getByRole("button", { name: "Sửa" }).click()
    const editor = root.getByRole("textbox", { name: "Chỉnh sửa bình luận" })
    await editor.fill("Bình luận E2E đã sửa 😺")
    await root.getByRole("button", { name: "Gửi bình luận" }).click()
    await expect(root.getByText("Bình luận E2E đã sửa 😺")).toBeVisible()

    await page.waitForTimeout(5_100)
    await root.getByRole("button", { name: "Trả lời" }).click()
    await root
      .getByRole("textbox", { name: /Trả lời Phase 7.5E Reader/ })
      .fill("Phản hồi E2E")
    await root.getByRole("button", { name: "Gửi bình luận" }).click()
    await expect(root.getByText("Phản hồi E2E")).toBeVisible()

    await root.getByRole("button", { name: "Xóa" }).first().click()
    const dialog = page.getByRole("dialog", { name: "Xóa bình luận?" })
    await expect(dialog).toBeVisible()
    await dialog.getByRole("button", { name: "Xóa" }).click()
    await expect(page.getByText("Bình luận đã bị xóa.")).toBeVisible()
  })

  test("logout removes private account state from subsequent routes", async ({
    page,
  }) => {
    await page.goto("/manage/account")
    await page.getByRole("button", { name: "Đăng xuất" }).click()
    await expect(page.getByText("Đăng xuất thành công")).toBeVisible()
    await page.goto("/my-library")
    await expect(page.getByText(/đăng nhập/i).first()).toBeVisible()
    await expect(page.getByText(account.name)).toHaveCount(0)
  })
})
