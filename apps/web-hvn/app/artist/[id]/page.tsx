import {
  PersonRedirect,
  type PersonRedirectProps,
} from "@/modules/manga/person-page"

export default function ArtistRedirectPage(props: PersonRedirectProps) {
  return <PersonRedirect {...props} role="artist" />
}
