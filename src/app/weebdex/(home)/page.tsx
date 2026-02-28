import { siteConfig } from "@/config/site";
import PopularMangaSwiper from "./_components/popular-manga";
import LatestUpdate from "./_components/latest-update";
import Recently from "./_components/recently";

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

export default function Page() {
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

      <div className="flex flex-col">
        <section className="h-[324px] md:h-[400px]">
          <PopularMangaSwiper />
        </section>

        <section className="-mt-4 md:-mt-8 lg:-mt-3">
         <LatestUpdate/>
        </section>

        <section className="mt-9">
          <Recently />
        </section>

        <section className="mt-9 grid grid-cols-1 gap-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          <div className="lg:col-span-2 xl:col-span-3 2xl:col-span-4">
            {/* <LazyLoadComponent>
                  <StaffPick />
                </LazyLoadComponent> */}
          </div>
          <div className="lg:col-span-2">
            {/* <LazyLoadComponent>
                  <LeaderBoard />
                </LazyLoadComponent> */}
          </div>
        </section>

        <section className="mt-9 grid grid-cols-1 gap-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          <div className="lg:col-span-2 xl:col-span-3 2xl:col-span-4">
            {/* <LazyLoadComponent>
                  <CompletedSwiper />
                </LazyLoadComponent> */}
          </div>
          <div className="lg:col-span-2">
            {/* <LazyLoadComponent>
                  <CommentFeed />
                </LazyLoadComponent> */}
          </div>
        </section>
      </div>
    </>
  );
}
