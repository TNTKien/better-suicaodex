import type { Metadata } from "next"

import { LegalPage } from "@/components/legal-page"
import { siteConfig } from "@/config/site"

export const metadata: Metadata = {
  title: "Copyright",
  alternates: { canonical: "/copyright" },
}

export default function CopyrightPage() {
  return (
    <LegalPage lastUpdated="April 21, 2026" title="Copyright">
      <h2>Copyright Notice</h2>
      <p>
        {siteConfig.shortName} respects intellectual property rights and handles
        copyright requests in good faith.
      </p>

      <h2>Removal Request</h2>
      <p>
        If you need us to remove copyrighted manga content, please contact us
        via email:{" "}
        <a href="mailto:contact@suicaodex.com">contact@suicaodex.com</a>.
      </p>
    </LegalPage>
  )
}
