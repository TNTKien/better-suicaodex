import { auth } from "@/auth";
import { LoginForm } from "@/components/login-form";
import { WarpBackground } from "@/components/ui/warp-background";
import { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

export function generateMetadata(): Metadata {
  return {
    title: "Đăng nhập - SuicaoDex",
  };
}

interface pageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function LoginPage({ searchParams }: pageProps) {
  const session = await auth();
  const { callback } = await getSearchParams({ searchParams });

  if (session) {
    redirect(callback);
  }

  return (
    <WarpBackground className="p-0 border-none!">
      <div className="grid lg:grid-cols-2 h-[calc(100vh-80px)]">
        <div className="flex flex-col gap-4 p-6 md:p-10">
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-xs">
              <LoginForm callback={callback} />
            </div>
          </div>
        </div>
        <div className="bg-muted relative hidden lg:block">
          <Image
            src="/images/doro_think.webp"
            alt="Image"
            className="absolute inset-0 h-full w-full object-cover"
            priority
            width={500}
            height={500}
            unoptimized
          />
        </div>
      </div>
    </WarpBackground>
  );
}

const getSearchParams = async ({ searchParams }: pageProps) => {
  const params = await searchParams;
  const callback = params.callback ?? "/";

  return {
    callback,
  };
};
