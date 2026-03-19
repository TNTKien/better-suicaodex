import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { getAuthSession } from "@/auth";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { db } from "@/lib/db";
import { accounts, users } from "@/lib/db/schema";
import { ProfileShowcase } from "./_components/profile-showcase";

export function generateMetadata(): Metadata {
  return {
    title: "Hồ sơ của tôi",
  };
}

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
});

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(date: Date | null) {
  return date ? dateFormatter.format(date) : "Chưa có dữ liệu";
}

function formatDateTime(date: Date | null) {
  return date ? dateTimeFormatter.format(date) : "Chưa có dữ liệu";
}

function pickText(...values: (string | null | undefined)[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return "";
}

export default async function Page() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    redirect(`/login?callback=${encodeURIComponent("/my-profile")}`);
  }

  const userId = session.user.id;

  const [userRow] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      image: users.image,
      betterEmailVerified: users.betterEmailVerified,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRow) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <hr className="h-1 w-9 border-none bg-primary" />
          <h1 className="text-2xl font-black uppercase">Hồ sơ của tôi</h1>
        </div>

        <Empty className="min-h-72 bg-muted/30">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldOff />
            </EmptyMedia>
            <EmptyTitle>Không tìm thấy hồ sơ nội bộ</EmptyTitle>
            <EmptyDescription className="max-w-lg text-pretty">
              Bạn đã đăng nhập nhưng chưa đọc được dữ liệu tài khoản SuicaoDex
              trong cơ sở dữ liệu. Hãy thử đăng xuất rồi đăng nhập lại.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const providerRows = await db
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const providers = Array.from(
    new Set(
      providerRows
        .map((row) => row.provider?.trim())
        .filter((provider): provider is string => Boolean(provider)),
    ),
  );

  const profile = {
    displayName: pickText(
      userRow.displayName,
      session.user.name,
      "Người dùng SuicaoDex",
    ),
    email: pickText(userRow.email, session.user.email, "Chưa có email"),
    avatar: pickText(
      userRow.image,
      session.user.image,
      "/avatars/doro_think.webp",
    ),
    status: userRow.betterEmailVerified,
    details: [
      { label: "User ID", value: userRow.id },
      {
        label: "Tên hiển thị",
        value: pickText(userRow.displayName, "Chưa có dữ liệu"),
      },
      {
        label: "Email",
        value: pickText(userRow.email, session.user.email, "Chưa có email"),
      },
      {
        label: "Ngày tham gia",
        value: formatDate(userRow.createdAt),
      },
      {
        label: "Trạng thái xác thực",
        value: userRow.betterEmailVerified ? "Đã xác thực" : "Chưa xác thực",
      },
      {
        label: "Cập nhật lần cuối",
        value: formatDateTime(userRow.updatedAt),
      },
    ],
    providers,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="absolute h-70 z-[-2] w-auto left-0 right-0 top-0 block">
        <div
          className="absolute h-70 w-full transition-[width] duration-150 ease-in-out bg-no-repeat bg-cover bg-position-[center_top_33%] md:bg-fixed"
          style={{ backgroundImage: `url('/images/frieren.webp')` }}
        ></div>
        <div className="absolute h-70 w-auto inset-0 pointer-events-none backdrop-blur-none md:backdrop-blur-xs bg-linear-to-r from-background/65 to-transparent"></div>

        <div className="md:hidden absolute h-70 w-auto inset-0 pointer-events-none backdrop-blur-[1px] bg-linear-to-b from-background/5 to-background"></div>
      </div>

      <div>
        <hr className="h-1 w-9 border-none bg-primary" />
        <h1 className="text-2xl font-black uppercase">Trang cá nhân</h1>
      </div>

      <ProfileShowcase profile={profile} />
    </div>
  );
}
