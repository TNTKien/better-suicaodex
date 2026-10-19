import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { Suspense } from "react"
import { pageHref, pageNumber } from "@workspace/catalog/pagination"

import { getPerson, type PersonDetail } from "@/lib/api"
import { getRoutePerson } from "@workspace/catalog/server"
import {
  personPath as canonicalPath,
  personRoleLabels as roleLabels,
  type PersonRole,
} from "@workspace/catalog/routing"
import { generateFaviconUrl, isUuid, parsePageNumber } from "@/lib/catalog"
import { buttonVariants } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

import { CatalogResults } from "./catalog-page"

export type PersonRedirectPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string | string[] }>
}

export type PersonPageProps = {
  params: Promise<{ id: string; slug: string }>
  searchParams: Promise<{ page?: string | string[] }>
}

async function PersonCanonicalRedirectContent({
  params,
  role,
  searchParams,
}: PersonRedirectPageProps & { role: PersonRole }) {
  const { id } = await params
  const person = await getRoutePerson<PersonDetail>(id)
  if (!person || !person.roles.includes(role)) notFound()

  const path = canonicalPath(role, person.id, person.slug)
  const page = parsePageNumber((await searchParams).page)
  return permanentRedirect(page === 1 ? path : `${path}?page=${page}`)
}

export function PersonCanonicalRedirect(
  props: PersonRedirectPageProps & { role: PersonRole }
) {
  return (
    <Suspense fallback={null}>
      <PersonCanonicalRedirectContent {...props} />
    </Suspense>
  )
}

export async function getPersonMetadata(
  role: PersonRole,
  params: PersonPageProps["params"],
  searchParams: PersonPageProps["searchParams"]
) {
  const { id } = await params
  const roleLabel = roleLabels[role]
  if (!isUuid(id))
    return { title: `Không tìm thấy ${roleLabel}` } satisfies Metadata

  const person = await getPerson(id)
  if (!person || !person.roles.includes(role)) {
    return { title: `Không tìm thấy ${roleLabel}` } satisfies Metadata
  }

  return {
    alternates: {
      canonical: pageHref(
        canonicalPath(role, person.id, person.slug),
        pageNumber((await searchParams).page)
      ),
    },
    description:
      person.description?.trim() ||
      `Khám phá truyện tranh của ${roleLabel.toLocaleLowerCase("vi")} ${person.name} trên SuicaoDex.`,
    title: `${roleLabel}: ${person.name}`,
  } satisfies Metadata
}

async function PersonDetails({
  id,
  role,
  searchParams,
  slug,
}: {
  id: string
  role: PersonRole
  searchParams: PersonPageProps["searchParams"]
  slug: string
}) {
  const person = await getPerson(id)
  if (!person || !person.roles.includes(role)) notFound()

  const path = canonicalPath(role, person.id, person.slug)
  if (slug !== person.slug) {
    const page = parsePageNumber((await searchParams).page)
    permanentRedirect(page === 1 ? path : `${path}?page=${page}`)
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{person.name}</h2>
      <p className="text-sm leading-6 whitespace-pre-line text-muted-foreground sm:text-base">
        {person.description ?? "Chưa có thông tin giới thiệu."}
      </p>
      {person.links.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {person.links.map((link) => (
            <a
              className={buttonVariants({ size: "sm", variant: "secondary" })}
              href={link.url}
              key={link.key}
              rel="noopener noreferrer"
              target="_blank"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Tiny remote favicon does not need image optimization. */}
              <img
                alt=""
                aria-hidden="true"
                className="size-4 rounded-full"
                data-icon="inline-start"
                height={16}
                src={generateFaviconUrl(link.url, 16)}
                width={16}
              />
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  )
}

async function PersonPageContent({
  params,
  role,
  searchParams,
}: PersonPageProps & { role: PersonRole }) {
  const { id, slug } = await params
  if (!isUuid(id)) {
    const person = await getRoutePerson<PersonDetail>(id)
    if (!person || !person.roles.includes(role)) notFound()
    const path = canonicalPath(role, person.id, person.slug)
    const page = parsePageNumber((await searchParams).page)
    permanentRedirect(page === 1 ? path : `${path}?page=${page}`)
  }

  const roleLabel = roleLabels[role]
  const path = canonicalPath(role, id, slug)

  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="section-heading text-2xl">{roleLabel}</h1>
      <Suspense
        fallback={
          <div className="flex min-h-48 items-center justify-center">
            <Spinner
              aria-label={`Đang tải ${roleLabel.toLocaleLowerCase("vi")}`}
            />
          </div>
        }
      >
        <PersonDetails
          id={id}
          role={role}
          searchParams={searchParams}
          slug={slug}
        />
        <CatalogResults
          artist={role === "artist" ? [id] : undefined}
          author={role === "author" ? [id] : undefined}
          path={path}
          searchParams={searchParams}
          sort="latestChapter"
          title={roleLabel}
        />
      </Suspense>
    </section>
  )
}

export function PersonCatalogPage(
  props: PersonPageProps & { role: PersonRole }
) {
  return (
    <Suspense fallback={null}>
      <PersonPageContent {...props} />
    </Suspense>
  )
}
