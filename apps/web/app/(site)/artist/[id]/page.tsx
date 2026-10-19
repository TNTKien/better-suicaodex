import {
  PersonCanonicalRedirect,
  type PersonRedirectPageProps,
} from "../../person-catalog-page"

export default function ArtistRedirectPage(props: PersonRedirectPageProps) {
  return <PersonCanonicalRedirect {...props} role="artist" />
}
