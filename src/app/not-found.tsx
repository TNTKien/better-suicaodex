import { Metadata } from "next";
import NotFoundPage from "@/components/not-found";

export const metadata: Metadata = {
  title: "404 Not Found",
};

export default function NotFound() {
  return <NotFoundPage />;
}
