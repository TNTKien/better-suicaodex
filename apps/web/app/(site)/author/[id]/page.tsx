import {
  PersonCanonicalRedirect,
  type PersonRedirectPageProps,
} from "../../person-catalog-page"

export default function AuthorRedirectPage(props: PersonRedirectPageProps) {
  return <PersonCanonicalRedirect {...props} role="author" />
}
