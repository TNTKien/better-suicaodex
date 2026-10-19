import type { ReactNode } from "react"

export function LegalPage({
  children,
  lastUpdated,
  title,
}: {
  children: ReactNode
  lastUpdated: string
  title: string
}) {
  return (
    <section className="mx-auto w-full max-w-480 px-4 py-6 sm:px-6">
      <article className="mx-auto flex max-w-4xl flex-col gap-4 text-sm leading-7 sm:text-base [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-4 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        <header className="mb-2 flex flex-col gap-2">
          <h1 className="section-heading text-2xl">{title}</h1>
          <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
        </header>
        {children}
      </article>
    </section>
  )
}
