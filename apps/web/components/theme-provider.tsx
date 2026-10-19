"use client"

import * as React from "react"
import { MoonIcon, SunIcon } from "lucide-react"
import {
  ThemeProvider as NextThemesProvider,
  useTheme,
} from "@teispace/next-themes"

import { Button } from "@workspace/ui/components/button"

function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      themeColor={{ light: "#ffffff", dark: "#0c0a09" }}
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {/* <ThemeHotkey /> */}
      {children}
    </NextThemesProvider>
  )
}

// function isTypingTarget(target: EventTarget | null) {
//   if (!(target instanceof HTMLElement)) {
//     return false
//   }

//   return (
//     target.isContentEditable ||
//     target.tagName === "INPUT" ||
//     target.tagName === "TEXTAREA" ||
//     target.tagName === "SELECT"
//   )
// }

// function ThemeHotkey() {
//   const { resolvedTheme, setTheme } = useTheme()

//   React.useEffect(() => {
//     function onKeyDown(event: KeyboardEvent) {
//       if (event.defaultPrevented || event.repeat) {
//         return
//       }

//       if (event.metaKey || event.ctrlKey || event.altKey) {
//         return
//       }

//       if (event.key.toLowerCase() !== "d") {
//         return
//       }

//       if (isTypingTarget(event.target)) {
//         return
//       }

//       setTheme(resolvedTheme === "dark" ? "light" : "dark")
//     }

//     window.addEventListener("keydown", onKeyDown)

//     return () => {
//       window.removeEventListener("keydown", onKeyDown)
//     }
//   }, [resolvedTheme, setTheme])

//   return null
// }

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const label = "Chuyển đổi giao diện sáng/tối"

  return (
    <Button
      aria-label={label}
      className="relative shrink-0"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      size="icon-sm"
      title={label}
      variant="outline"
    >
      <SunIcon className="scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
      <MoonIcon className="absolute scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
    </Button>
  )
}

export { ThemeProvider, ThemeToggle }
