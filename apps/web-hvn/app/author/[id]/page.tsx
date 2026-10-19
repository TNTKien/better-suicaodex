import {
  PersonRedirect,
  type PersonRedirectProps,
} from "@/modules/manga/person-page"

export default function AuthorRedirectPage(props: PersonRedirectProps) {
  return <PersonRedirect {...props} role="author" />
}
