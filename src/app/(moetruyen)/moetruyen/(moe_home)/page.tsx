import LatestUpdate from "@/app/(suicaodex)/(home)/_components/latest-update";
import PopularMangaSwiper from "@/app/(suicaodex)/(home)/_components/popular-manga";
import Recently from "@/app/(suicaodex)/(home)/_components/recently-manga";

export default function MoetruyenPage() {
  return (
    <div className="flex flex-col">
      <section className=""></section>

      <section className="mt-9 mx-4 md:mx-8 lg:mx-12"></section>

      <section className="mt-9 mx-4 md:mx-8 lg:mx-12"></section>

      <section className="mt-9 mx-4 md:mx-8 lg:mx-12 grid grid-cols-1 gap-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        <div className="lg:col-span-2 xl:col-span-3 2xl:col-span-4"></div>
        <div className="lg:col-span-2"></div>
      </section>
    </div>
  );
}
