"use client";


import LatestUpdate from "./LatestUpdate";
import LeaderBoard from "./LeaderBoard";
import RecentlyAdded from "./Recently";
import StaffPick from "./StaffPick";
import CompletedSwiper from "./Swiper/Completed";
import PopularSwiper from "./Swiper/Popular";
import { LazyLoadComponent } from "react-lazy-load-image-component";
import CommentFeed from "@/components/Comment/CommentFeed";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <section className="h-[324px] md:h-[400px]">
        <PopularSwiper />
      </section>

      <section className="-mt-4 md:-mt-8 lg:-mt-3">
        <LatestUpdate />
      </section>

      <section className="mt-9">
        <LazyLoadComponent>
          <RecentlyAdded />
        </LazyLoadComponent>
      </section>

      <section className="mt-9 grid grid-cols-1 gap-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
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
      </section>

      <section className="mt-9">
        <LazyLoadComponent>
          <CommentFeed />
        </LazyLoadComponent>
      </section>

      <section className="mt-6">
        <LazyLoadComponent>
          <CompletedSwiper />
        </LazyLoadComponent>
      </section>
    </div>
  );
}
