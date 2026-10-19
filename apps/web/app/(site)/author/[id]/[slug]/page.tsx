import {
  getPersonMetadata,
  PersonCatalogPage,
  type PersonPageProps,
} from "../../../person-catalog-page"

export function generateMetadata({ params, searchParams }: PersonPageProps) {
  return getPersonMetadata("author", params, searchParams)
}

export default function AuthorPage(props: PersonPageProps) {
  return <PersonCatalogPage {...props} role="author" />
}
