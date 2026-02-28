import { Metadata } from "next";
import RandomManga from "./_components";

export const metadata: Metadata = {
  title: "Truyện ngẫu nhiên",
  description: "Manga ngẫu nhiên",
};

export default function Page() {
  return <RandomManga />;
}
