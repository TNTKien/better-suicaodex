import {
  getPersonMetadata,
  PersonCatalogPage,
  type PersonPageProps,
} from "@/modules/manga/person-page"

export function generateMetadata({ params }: PersonPageProps) {
  return getPersonMetadata("artist", params)
}

export default function ArtistPage(props: PersonPageProps) {
  return <PersonCatalogPage {...props} role="artist" />
}
