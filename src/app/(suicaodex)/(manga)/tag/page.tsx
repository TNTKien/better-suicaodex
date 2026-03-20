import { Metadata } from "next";
import TagsPageWeebdex from "./_components";

export function generateMetadata(): Metadata {
  return {
    title: "Thể loại",
    description: "Manga theo thể loại",
    keywords: ["Thể loại", "Genre", "WeebDex"],
  };
}

export default function Page() {
  return (
    <>
      <div className="px-4 md:px-8 lg:px-12">
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">Thể loại</h1>
      </div>

      <div className="w-full mt-4 px-4 md:px-8 lg:px-12">
        <TagsPageWeebdex />
      </div>
    </>
  );
}
