import { Metadata } from "next";
import { redirect } from "next/navigation";

export function generateMetadata(): Metadata {
  return {
    title: "Đăng nhập",
  };
}

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function LegacyLoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const callback = params.callback ?? "/";
  redirect(`/auth/signin?callback=${encodeURIComponent(callback)}`);
}
