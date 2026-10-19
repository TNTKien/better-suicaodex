"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import { useScrollSpy, useWindowEvent } from "@mantine/hooks"
import {
  BookOpenIcon,
  ImageIcon,
  LinkIcon,
  ListIcon,
  TagsIcon,
  UsersIcon,
} from "lucide-react"

const sections = [
  { id: "title", label: "Tiêu đề", icon: BookOpenIcon },
  { id: "metadata", label: "Metadata", icon: ListIcon },
  { id: "groups", label: "Nhóm dịch", icon: UsersIcon },
  { id: "genres", label: "Thể loại", icon: TagsIcon },
  { id: "links", label: "Liên kết", icon: LinkIcon },
  { id: "cover", label: "Ảnh bìa", icon: ImageIcon },
]

export function MangaFormNav() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const spy = useScrollSpy({
    selector: "#title, #metadata, #groups, #genres, #links, #cover",
    offset: 96,
  })
  const activeId = selectedId ?? spy.data[spy.active]?.id ?? "title"
  const firstSync = useRef(true)

  useWindowEvent("wheel", () => setSelectedId(null))
  useWindowEvent("touchstart", () => setSelectedId(null))
  useWindowEvent("keydown", (event) => {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest("input, textarea, select, [contenteditable]")
    ) {
      return
    }
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "PageUp",
        "PageDown",
        "Home",
        "End",
        " ",
      ].includes(event.key)
    ) {
      setSelectedId(null)
    }
  })
  const syncHash = useCallback(
    (nav: HTMLElement | null) => {
      if (!nav || !spy.initialized || spy.active < 0) return
      if (firstSync.current) {
        firstSync.current = false
        if (window.location.hash) return
      }
      if (window.location.hash !== `#${activeId}`) {
        window.history.replaceState(window.history.state, "", `#${activeId}`)
      }
    },
    [activeId, spy.active, spy.initialized]
  )

  return (
    <nav
      aria-label="Các phần của biểu mẫu"
      className="flex gap-1 overflow-x-auto pb-1 lg:sticky lg:top-20 lg:flex-col lg:self-start lg:overflow-visible"
      data-manga-form-nav
      ref={syncHash}
    >
      {sections.map(({ id, label, icon: Icon }) => (
        <Link
          aria-current={activeId === id ? "location" : undefined}
          className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${
            activeId === id
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          href={`#${id}`}
          key={id}
          onClick={(event) => {
            if (
              event.button === 0 &&
              !event.metaKey &&
              !event.ctrlKey &&
              !event.shiftKey &&
              !event.altKey
            ) {
              setSelectedId(id)
            }
          }}
        >
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
