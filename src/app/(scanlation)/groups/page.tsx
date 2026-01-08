import { Metadata } from "next";
import GroupsSearch from "@/components/Groups/groups-search";

interface pageProps {
  searchParams: Promise<{
    [key: string]: string | undefined;
  }>;
}

export function generateMetadata(): Metadata {
  return {
    title: "Nhóm dịch - SuicaoDex",
    // description: "Nhóm dịch",
    // keywords: ["Nhóm dịch", "SuicaoDex"],
  };
}
export default async function Page({ searchParams }: pageProps) {
  const { page, q } = await getSearchParams({ searchParams });

  return (
    <>
      <div>
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">Nhóm dịch</h1>
      </div>

      <div className="mt-4">
        <GroupsSearch page={page} q={q} />
      </div>
    </>
  );
}

const getSearchParams = async ({ searchParams }: pageProps) => {
  const params = await searchParams;

  const page = params["page"] ? parseInt(params["page"]) : 1;
  const q = params["q"] || "";

  return { page, q };
};
