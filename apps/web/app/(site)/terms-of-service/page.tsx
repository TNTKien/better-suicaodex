import type { Metadata } from "next"

import { LegalPage } from "@/components/legal-page"
import { siteConfig } from "@/config/site"

export const metadata: Metadata = {
  title: "Terms of Service",
  alternates: { canonical: "/terms-of-service" },
}

export default function TermsOfServicePage() {
  return (
    <LegalPage lastUpdated="February 15, 2026" title="Terms of Service">
      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using {siteConfig.shortName} services, you agree to
        these Terms of Service. If you do not agree, please do not use the
        service.
      </p>

      <h2>2. Eligibility and Accounts</h2>
      <p>
        You are responsible for your account activity and for maintaining the
        security of your login methods. You agree to provide accurate account
        information.
      </p>

      <h2>3. Permitted Use</h2>
      <p>
        You may use the service only for lawful purposes and in accordance with
        these terms.
      </p>

      <h2>4. Prohibited Conduct</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Post unlawful, abusive, harassing, or infringing content.</li>
        <li>
          Attempt to disrupt, overload, reverse engineer, or compromise the
          service.
        </li>
        <li>
          Use bots or automation to abuse features, spam, or bypass limits.
        </li>
        <li>Impersonate others or misrepresent your identity.</li>
      </ul>

      <h2>5. User Content</h2>
      <p>
        You retain rights to content you submit, but grant us a non-exclusive
        right to host, display, and moderate that content for service operation
        and community safety.
      </p>

      <h2>6. Intellectual Property</h2>
      <p>
        Website design, software, branding, and service materials are protected
        by applicable intellectual property laws. Do not copy or redistribute
        them without permission.
      </p>

      <h2>7. Third-Party Services</h2>
      <p>
        The service may integrate with third-party providers (for example OAuth,
        storage, or analytics). Your use of those services is also subject to
        their own terms and policies.
      </p>

      <h2>8. Disclaimer of Warranties</h2>
      <p>
        The service is provided &quot;as is&quot; and &quot;as available&quot;
        without warranties of any kind, to the extent permitted by law.
      </p>

      <h2>9. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, {siteConfig.shortName} is not
        liable for indirect, incidental, special, consequential, or punitive
        damages arising from use of the service.
      </p>

      <h2>10. Suspension and Termination</h2>
      <p>
        We may suspend or terminate access for violations of these terms, abuse,
        security risks, or legal requirements.
      </p>

      <h2>11. Changes to These Terms</h2>
      <p>
        We may update these terms from time to time. Continued use after updates
        means you accept the revised terms.
      </p>

      <h2>12. Contact</h2>
      <p>
        For questions about these Terms of Service, contact{" "}
        {siteConfig.shortName} through our official website channels.
      </p>
    </LegalPage>
  )
}
