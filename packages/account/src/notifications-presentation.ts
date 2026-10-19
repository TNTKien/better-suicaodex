import { tz } from "@date-fns/tz"
import { format, parseISO } from "date-fns"

type ChapterIdentity = {
  volume: string | null
  number: string | null
  title: string | null
}
type NotificationContent =
  | {
      type: "manga_new_chapter"
      manga: { title: string }
      chapter: ChapterIdentity & { id: string }
    }
  | { type: "system_notice"; notice: { id: string; title: string } }
  | {
      type:
        | "group_join_requested"
        | "group_join_approved"
        | "group_join_rejected"
        | "group_member_removed"
        | "group_member_left"
        | "group_approved"
        | "group_leader_assigned"
        | "group_rejected"
        | "content_group_added"
      group: { name: string }
      actor: { name: string } | null
    }

export function readerChapterLabel(chapter: ChapterIdentity) {
  return [
    chapter.volume ? `Vol. ${chapter.volume}` : null,
    chapter.number ? `Ch. ${chapter.number}` : "Oneshot",
    chapter.title,
  ]
    .filter(Boolean)
    .join(" - ")
}

const vietnamTimeZone = tz("Asia/Ho_Chi_Minh")

export function notificationTime(value: string) {
  return format(parseISO(value), "dd/MM/yyyy HH:mm", { in: vietnamTimeZone })
}

export function notificationPresentation(item: NotificationContent) {
  if (item.type === "manga_new_chapter")
    return {
      title: item.manga.title,
      description: readerChapterLabel(item.chapter),
      href: `/chapter/${item.chapter.id}`,
    }

  if (item.type === "system_notice")
    return {
      title: item.notice.title,
      description: "Thông báo hệ thống",
      href: `/system-notice?notice=${item.notice.id}`,
    }

  const title = item.group.name
  const href = "/manage/group"
  const actor = item.actor?.name ?? "Một thành viên"
  switch (item.type) {
    case "group_join_requested":
      return { title, description: `${actor} muốn gia nhập nhóm`, href }
    case "group_join_approved":
      return {
        title,
        description: "Yêu cầu gia nhập đã được chấp nhận",
        href,
      }
    case "group_join_rejected":
      return { title, description: "Yêu cầu gia nhập đã bị từ chối", href }
    case "group_member_removed":
      return { title, description: "Bạn đã bị xóa khỏi nhóm", href }
    case "group_member_left":
      return { title, description: `${actor} đã rời nhóm`, href }
    case "group_approved":
      return { title, description: "Nhóm đã được duyệt", href }
    case "group_leader_assigned":
      return { title, description: "Bạn đã trở thành trưởng nhóm", href }
    case "group_rejected":
      return { title, description: "Nhóm đã bị từ chối", href }
    case "content_group_added":
      return {
        title,
        description: "Nhóm đã được thêm vào một nội dung hợp tác",
        href,
      }
  }
}
