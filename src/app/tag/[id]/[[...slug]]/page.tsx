import NotFound from "@/app/not-found";
import TagPage from "@/components/Pages/Tags/Tag";
import { getTagById } from "@/lib/mangadex/tag";
import { Metadata } from "next";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    [key: string]: string | undefined;
  }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const { page } = await getSearchParams(searchParams);
  try {
    const tag = await getTagById(id);
    if (!tag) {
      return { title: "404 Not Found" };
    }
    return {
      title:
        page > 1
          ? `Trang ${page} - ${tag.name} - SuicaoDex`
          : `${tag.name} - SuicaoDex`,
      description: `Truyện thuộc thể loại ${tag.name}`,
      keywords: ["Thể loại", "Genre", tag.name, tag.group, "SuicaoDex"],
    };
  } catch (error) {
    console.log(error);
    return { title: "Lỗi mất rồi 😭" };
  }
}

export default async function Page({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { page } = await getSearchParams(searchParams);
  try {
    const tag = await getTagById(id);
    if (!tag) {
      return <NotFound />;
    }
    return (
      <>
        <div>
          <hr className="w-9 h-1 bg-primary border-none" />
          <h1 className="text-2xl font-black uppercase">{tag.name}</h1>
        </div>

        <TagPage id={id} page={page} />

        {/* <div className="w-full mt-4">
          <TagPage id={id} page={page} />
        </div> */}
      </>
    );
  } catch (error) {
    console.log("Error fetching tag:", error);
    return <div>Lỗi mất rồi 😭</div>;
  }
}

const getSearchParams = async (
  searchParams: Promise<{ [key: string]: string | undefined }>
) => {
  const params = await searchParams;
  const page = params["page"] ? parseInt(params["page"]) : 1;
  return { page };
};
