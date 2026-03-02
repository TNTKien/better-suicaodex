import { auth } from "@/auth";
import { getUserLibrary } from "@/lib/suicaodex/db";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { BookOpen } from "lucide-react";
import AccountCategoryTabs from "./account-category-tabs";

export default async function AccountLibraryList() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <Empty className="bg-muted/30 h-full mt-2">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpen />
          </EmptyMedia>
          <EmptyTitle>Bạn cần đăng nhập</EmptyTitle>
          <EmptyDescription>
            Đăng nhập để xem thư viện trên tài khoản
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const library = await getUserLibrary(session.user.id);

  return (
    <AccountCategoryTabs
      initialLibrary={{
        FOLLOWING: library.FOLLOWING,
        READING: library.READING,
        PLAN: library.PLAN,
        COMPLETED: library.COMPLETED,
      }}
    />
  );
}

