import Author from "@/components/Pages/Author";
import { GetAuthor } from "@/lib/mangadex/author";
import { Metadata } from "next";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const author = await GetAuthor(id);
    return { title: `${author.name} - SuicaoDex` };
  } catch (error) {
    console.error("Error fetching author:", error);
    return { title: "SuicaoDex" };
  }
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <Author id={id} />;
}
