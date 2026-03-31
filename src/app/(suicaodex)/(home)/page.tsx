import { siteConfig } from "@/config/site";
import PopularMangaSwiper from "./_components/popular-manga";
import MoetruyenSection from "./_components/moetruyen-section";
import LatestUpdate from "./_components/latest-update";
import Recently from "./_components/recently-manga";
import CompletedManga from "./_components/completed-manga";
import CommentsFeed from "./_components/comments-feed";

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

export const metadata = {
  title: "Home",
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
        <section className="">
          <PopularMangaSwiper />
        </section>

        <section className="mt-9 mx-4 md:mx-8 lg:mx-12">
          <MoetruyenSection />
        </section>

        {/* <section className="mt-9 mx-4 md:mx-8 lg:mx-12">
          <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
            <OctagonAlert strokeWidth={3} />
            <AlertTitle className="font-semibold uppercase">
              Thông báo quan trọng
            </AlertTitle>
            <AlertDescription>
              <Streamdown
                linkSafety={{ enabled: false }}
                className="font-medium"
              >
                V/v: Thay đổi nguồn dữ liệu và 1 số tính năng tạm thời không
                hoạt động. Xem chi tiết [tại đây](/notifications).
              </Streamdown>
              <span className="text-xs font-medium">01/03/2026</span>
            </AlertDescription>
          </Alert>
        </section> */}

        {/* <section className="-mt-4 md:-mt-8 lg:-mt-3"> */}
        <section className="mt-9 mx-4 md:mx-8 lg:mx-12">
          <LatestUpdate />
        </section>

        <section className="mt-9 mx-4 md:mx-8 lg:mx-12">
          <Recently />
        </section>

        {/* Temporary disabled because less of data */}
        {/* <section className="mt-9 grid grid-cols-1 gap-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          <div className="lg:col-span-2 xl:col-span-3 2xl:col-span-4">
            <LazyLoadComponent>
              <StaffPick />
            </LazyLoadComponent>
          </div>
          <div className="lg:col-span-2">
            <LazyLoadComponent>
              <LeaderBoard />
            </LazyLoadComponent>
          </div>
        </section> */}

        <section className="mt-9 mx-4 md:mx-8 lg:mx-12 grid grid-cols-1 gap-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          <div className="lg:col-span-2 xl:col-span-3 2xl:col-span-4">
            <CompletedManga />
          </div>
          <div className="lg:col-span-2">
            <CommentsFeed />
          </div>
        </section>
      </div>
    </>
  );
}
