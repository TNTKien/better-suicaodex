import { DownloadsManagerPage } from "@/features/downloads/DownloadsManagerPage";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Downloads Manager - SuicaoDex",
  description: "Manage your offline chapters and downloads",
};

export default function Page() {
  return <DownloadsManagerPage />;
}