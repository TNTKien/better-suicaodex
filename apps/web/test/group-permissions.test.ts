import assert from "node:assert/strict"
import "./group-coin.test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
  applyPermissionGroup,
  GroupSummary,
  resolveGroupView,
} from "../modules/groups/workspace"
import { validateGroupMediaFile } from "../modules/groups/media-fields"

const permissions = {
  canAddManga: false,
  canEditManga: true,
  canDeleteManga: false,
  canAddChapter: true,
  canEditChapter: true,
  canDeleteChapter: true,
}

assert.deepEqual(
  applyPermissionGroup(
    permissions,
    ["canAddManga", "canEditManga", "canDeleteManga"],
    true
  ),
  {
    ...permissions,
    canAddManga: true,
    canEditManga: true,
    canDeleteManga: true,
  }
)

assert.deepEqual(
  applyPermissionGroup(
    permissions,
    ["canAddChapter", "canEditChapter", "canDeleteChapter"],
    false
  ),
  {
    ...permissions,
    canAddChapter: false,
    canEditChapter: false,
    canDeleteChapter: false,
  }
)

assert.equal(validateGroupMediaFile({ size: 1024, type: "image/webp" }), null)
assert.match(
  validateGroupMediaFile({ size: 1024, type: "image/svg+xml" }) ?? "",
  /JPEG, PNG hoặc WebP/
)
assert.match(
  validateGroupMediaFile({ size: 5 * 1024 * 1024 + 1, type: "image/png" }) ??
    "",
  /5 MiB/
)

for (const approvalStatus of ["pending", "approved"] as const) {
  for (const status of ["pending", "approved"] as const) {
    for (const role of ["member", "leader"] as const) {
      const markup = renderToStaticMarkup(
        createElement(GroupSummary, {
          current: {
            group: {
              id: "0199f711-739b-7000-8000-000000000001",
              name: "Nhóm dịch",
              slug: "nhom-dich",
              approvalStatus,
              publicationState: "published",
              inactive: false,
              avatarUrl: null,
              bannerUrl: null,
              description: null,
              links: {},
              createdAt: "2026-10-09T00:00:00Z",
              updatedAt: "2026-10-09T00:00:00Z",
            },
            membership: {
              status,
              role,
              name: "Thành viên",
              userId: "reader",
              permissions,
              avatarFrame: null,
              createdAt: "2026-10-09T00:00:00Z",
            },
          },
          pending: resolveGroupView(approvalStatus, status) === "pending",
          busy: false,
          onEdit: () => {},
          onCancel: () => {},
          onLeave: () => {},
        })
      )
      const approved = approvalStatus === "approved" && status === "approved"
      assert.equal(markup.includes("QL Truyện"), approved)
      assert.equal(
        markup.includes("Sửa thông tin"),
        approved && role === "leader"
      )
      assert.equal(
        markup.includes("Xem trang nhóm"),
        approvalStatus === "approved"
      )
      assert.equal(markup.includes("Hủy yêu cầu"), !approved)
    }
  }
}

console.log("Group permission and media checks passed")
