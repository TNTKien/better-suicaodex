import { redirect } from "next/navigation"

export const instant = false

export default function AdminCommentsPage() {
  redirect("/admin/comments/list")
}
