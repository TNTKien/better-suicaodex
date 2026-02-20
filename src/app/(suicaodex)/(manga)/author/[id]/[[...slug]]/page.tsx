import Author from "@/components/Pages/Author";
import { GetAuthor } from "@/lib/mangadex/author";
import { Metadata } from "next";
import { cache } from "react";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

const getCachedAuthorData = cache(async (id: string) => {
  return await GetAuthor(id);
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const author = await getCachedAuthorData(id);
    return { title: `${author.name} - SuicaoDex` };
  } catch (error) {
    console.error("Error fetching author:", error);
    return { title: "SuicaoDex" };
  }
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  try {
    const initialData = await getCachedAuthorData(id);
    return <Author id={id} initialData={initialData} />;
  } catch (error) {
    console.log("Error loading author", error);
    return <Author id={id} />;
  }
}
