import MoePopularManga from "./_components/moe_popular-manga";
import MoeLatestUpdate from "./_components/moe_latest-update";
import MoeLeaderboard from "./_components/moe_leaderboard";
import MoeRecentComments from "./_components/moe_recent-comments";

export default function MoetruyenPage() {
  return (
    <div className="flex flex-col">
      <section className="">
        <MoePopularManga />
      </section>

      <section className="mt-9 mx-4 md:mx-8 lg:mx-12">
        <MoeLatestUpdate />
      </section>

      <section className="mt-9 mx-4 md:mx-8 lg:mx-12 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div>
          <MoeLeaderboard />
        </div>
        <div>
          <MoeRecentComments />
        </div>
      </section>
    </div>
  );
}
