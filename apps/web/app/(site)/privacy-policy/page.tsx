import type { Metadata } from "next"

import { LegalPage } from "@/components/legal-page"
import { siteConfig } from "@/config/site"

export const metadata: Metadata = {
  title: "Privacy Policy",
  alternates: { canonical: "/privacy-policy" },
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPage lastUpdated="February 15, 2026" title="Privacy Policy">
      <h2>1. Introduction</h2>
      <p>
        This Privacy Policy explains how {siteConfig.shortName} (&quot;we&quot;,
        &quot;our&quot;, &quot;us&quot;) collects, uses, and protects
        information when you use our website and related services.
      </p>

      <h2>2. Information We Collect</h2>
      <p>We may collect the following categories of information:</p>
      <ul>
        <li>
          Account details from OAuth providers, such as user ID, email address,
          display name, and avatar.
        </li>
        <li>
          Profile information you choose to provide, such as bio or social
          links.
        </li>
        <li>User-generated content, including comments and reading history.</li>
        <li>
          Technical and usage data needed for security, abuse prevention, and
          service reliability.
        </li>
      </ul>

      <h2>3. How We Use Information</h2>
      <p>We use collected information to:</p>
      <ul>
        <li>Authenticate users and maintain account sessions.</li>
        <li>
          Provide website features (comments, profile, reading history, and
          moderation).
        </li>
        <li>Protect the platform from spam, abuse, and unauthorized access.</li>
        <li>Improve performance and user experience.</li>
      </ul>

      <h2>4. Google API Data</h2>
      <p>
        If you sign in with Google, we only request the minimum information
        required for authentication and account functionality. We do not sell
        Google user data.
      </p>
      <p>
        Our use and transfer of information received from Google APIs adheres to
        the{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          rel="noopener noreferrer"
          target="_blank"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2>5. Sharing of Information</h2>
      <p>
        We do not sell personal information. We may share data only with trusted
        service providers necessary to operate the service (for example,
        hosting, database, and authentication providers), or when required by
        law.
      </p>

      <h2>6. Data Retention</h2>
      <p>
        We retain data for as long as needed to provide the service, maintain
        security and moderation records, and comply with legal obligations.
      </p>

      <h2>7. Security</h2>
      <p>
        We apply reasonable technical and organizational safeguards to protect
        data. However, no system can be guaranteed to be 100% secure.
      </p>

      <h2>8. Your Choices</h2>
      <p>
        You can stop using the service at any time, sign out of your account,
        and request profile updates or deletion where applicable.
      </p>

      <h2>9. Children&apos;s Privacy</h2>
      <p>
        Our services are not directed to children under the age required by
        applicable law in your jurisdiction.
      </p>

      <h2>10. Contact</h2>
      <p>
        For privacy-related questions, contact {siteConfig.shortName} through
        our official website channels.
      </p>
    </LegalPage>
  )
}
