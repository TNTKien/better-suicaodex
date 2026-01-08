import TagsPage from "@/components/Pages/Tags";
import { Metadata } from "next";

export function generateMetadata(): Metadata {
  return {
    title: "Thể loại - SuicaoDex",
    description: "Truyện theo thể loại",
    keywords: ["Thể loại", "Genre", "SuicaoDex"],
  };
}

export default function Page() {
  return (
    <>
      <div>
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">Thể loại</h1>
      </div>

      <div className="w-full mt-4">
        <TagsPage />
      </div>
    </>
  );
}
