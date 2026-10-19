import {
  getPersonMetadata,
  PersonCatalogPage,
  type PersonPageProps,
} from "../../../person-catalog-page"

export function generateMetadata({ params, searchParams }: PersonPageProps) {
  return getPersonMetadata("artist", params, searchParams)
}

export default function ArtistPage(props: PersonPageProps) {
  return <PersonCatalogPage {...props} role="artist" />
}
