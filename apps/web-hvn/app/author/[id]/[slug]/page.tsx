import {
  getPersonMetadata,
  PersonCatalogPage,
  type PersonPageProps,
} from "@/modules/manga/person-page"

export function generateMetadata({ params }: PersonPageProps) {
  return getPersonMetadata("author", params)
}

export default function AuthorPage(props: PersonPageProps) {
  return <PersonCatalogPage {...props} role="author" />
}
