import HomePage from "@/components/Pages/Home";
import { siteConfig } from "@/config/site";

function breadcrumbJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Trang chủ",
        item: `${siteConfig.url}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Website đọc truyện chính thức",
        item: `${siteConfig.url}/latest`,
      },
    ],
  };
}

function searchActionJsonLd() {
  return {
    "@context": "http://schema.org",
    "@type": "WebSite",
    url: siteConfig.url,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteConfig.url}/advanced-search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

function organizationJsonLd() {
  return {
    "@context": "http://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: `${siteConfig.url}/logo.png`,
    sameAs: [
      siteConfig.links.discord,
      siteConfig.links.github,
      siteConfig.links.facebook,
    ],
  };
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd()),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(searchActionJsonLd()),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd()),
        }}
      />
      <HomePage />
    </>
  );
}
