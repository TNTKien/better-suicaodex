import "server-only"

import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { Suspense } from "react"
import { getPerson, getRoutePerson } from "@workspace/catalog/server"
import {
  isUuid,
  parsePageNumber,
  personPath,
  personRoleLabels,
  type PersonRole,
} from "@workspace/catalog/routing"
import { pageHref } from "@workspace/catalog/pagination"
import { Spinner } from "@workspace/ui/components/spinner"
import type { components } from "@/src/lib/generated/api"
import { CatalogPage, type CatalogSearchParams } from "./catalog"

type PersonDetail = components["schemas"]["PersonDetail"]
export type PersonPageProps = {
  params: Promise<{ id: string; slug: string }>
  searchParams: CatalogSearchParams
}
export type PersonRedirectProps = {
  params: Promise<{ id: string }>
  searchParams: CatalogSearchParams
}

export async function getPersonMetadata(
  role: PersonRole,
  params: PersonPageProps["params"]
): Promise<Metadata> {
  const { id } = await params
  const roleLabel = personRoleLabels[role]
  if (!isUuid(id)) return { title: `Không tìm thấy ${roleLabel}` }
  const person = await getPerson<PersonDetail>(id)
  if (!person || !person.roles.includes(role))
    return { title: `Không tìm thấy ${roleLabel}` }
  return {
    title: `${roleLabel}: ${person.name}`,
    description: person.description,
    alternates: { canonical: personPath(role, person.id, person.slug) },
  }
}

export async function PersonPageContent({
  params,
  searchParams,
  role,
}: PersonPageProps & { role: PersonRole }) {
  const { id, slug } = await params
  const person = await getRoutePerson<PersonDetail>(id)
  if (!person || !person.roles.includes(role)) notFound()
  const path = personPath(role, person.id, person.slug)
  if (!isUuid(id) || slug !== person.slug) {
    permanentRedirect(
      pageHref(path, parsePageNumber((await searchParams).page))
    )
  }
  return (
    <CatalogPage
      title={person.name}
      path={path}
      sort="latestChapter"
      person={{ id: person.id, name: person.name, role }}
      searchParams={searchParams}
    />
  )
}

export function PersonCatalogPage(
  props: PersonPageProps & { role: PersonRole }
) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-48 items-center justify-center">
          <Spinner
            aria-label={`Đang tải ${personRoleLabels[props.role].toLocaleLowerCase("vi")}`}
          />
        </div>
      }
    >
      <PersonPageContent {...props} />
    </Suspense>
  )
}

async function PersonRedirectContent({
  params,
  searchParams,
  role,
}: PersonRedirectProps & { role: PersonRole }) {
  const { id } = await params
  const person = await getRoutePerson<PersonDetail>(id)
  if (!person || !person.roles.includes(role)) notFound()
  return permanentRedirect(
    pageHref(
      personPath(role, person.id, person.slug),
      parsePageNumber((await searchParams).page)
    )
  )
}

export function PersonRedirect(
  props: PersonRedirectProps & { role: PersonRole }
) {
  return (
    <Suspense fallback={null}>
      <PersonRedirectContent {...props} />
    </Suspense>
  )
}
