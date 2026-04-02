import { type Metadata } from "next";

import MoeRandomManga from "./_components";

export const metadata: Metadata = {
  title: "Truyện ngẫu nhiên",
  description: "Chuyển đến một truyện ngẫu nhiên từ MoeTruyen",
};

export default function Page() {
  return <MoeRandomManga />;
}
