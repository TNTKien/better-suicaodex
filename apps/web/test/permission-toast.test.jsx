import assert from "node:assert/strict"
import { mock } from "bun:test"

const notifications = []
const ref = { current: null }
let effect = () => {}
mock.module("react", () => ({
  useRef: () => ref,
  useEffect: (callback) => {
    effect = callback
  },
}))
mock.module("@workspace/ui/components/toast", () => ({
  toast: {
    add: (notification) => notifications.push(notification),
  },
}))
const { usePermissionToast: notifyPermission } =
  await import("../hooks/use-permission-toast")
notifyPermission("Bạn không có quyền thêm chương cho nhóm này.")
effect()
effect() // Strict Mode replay must not produce a second toast.
assert.equal(notifications.length, 1)
notifyPermission("Bạn không có quyền thêm chương cho nhóm này.")
effect()
assert.equal(notifications.length, 1)
notifyPermission("Truyện đã bị quản trị viên ẩn.")
effect()
assert.equal(notifications.length, 2)
notifyPermission(null)
effect()
assert.equal(notifications.length, 2)
notifyPermission("Truyện đã bị quản trị viên ẩn.")
effect()
assert.equal(
  notifications.length,
  3,
  "Notify again if access is restored then removed"
)
assert.equal(
  notifications.every(({ type }) => type === "error"),
  true
)
console.log("Permission toast checks passed")
