"use server";

import { getAuthSession } from "@/auth";
import { getMangaId } from "@/lib/weebdex/hooks/manga/manga";
import { parseMangaTitle } from "@/lib/weebdex/utils";
import { Category } from "../../../prisma/generated/enums";
import prisma from "../prisma";

async function checkAuth(userID: string): Promise<boolean> {
  const session = await getAuthSession();
  return session?.user?.id === userID || false;
}

export async function getMangaCategory(
  userId: string,
  mangaId: string,
): Promise<string> {
  try {
    // Kiểm tra xác thực
    if (!(await checkAuth(userId))) return "NONE";

    // Truy vấn nhanh với select chỉ lấy dữ liệu cần thiết
    const result = await prisma.libraryManga.findFirst({
      where: {
        mangaId,
        library: { userId }, // Kết nối thông qua thư viện của người dùng
      },
      select: { category: true },
    });

    return result?.category ?? "NONE";
  } catch (error) {
    console.error("Error fetching manga category:", error);
    throw new Error("Failed to fetch manga category.");
  }
}

export async function updateMangaCategory(
  userId: string,
  mangaId: string,
  category: Category | "NONE",
  latestChapterId?: string | null,
  title?: string,
  coverId?: string | null,
): Promise<{ message: string; status: number }> {
  try {
    // Kiểm tra xác thực
    if (!(await checkAuth(userId))) {
      return { message: "Vui lòng đăng nhập lại!", status: 401 };
    }

    // Tìm hoặc tạo thư viện người dùng bằng upsert để giảm truy vấn
    const library = await prisma.library.upsert({
      where: { userId },
      update: {}, // Không cần cập nhật gì nếu đã tồn tại
      create: { userId }, // Tạo mới nếu chưa tồn tại
    });

    const libraryId = library.id;

    if (category === "NONE") {
      // Xóa Manga khỏi thư viện nếu category là "NONE"
      const deleteResult = await prisma.libraryManga.deleteMany({
        where: { libraryId, mangaId },
      });

      return deleteResult.count
        ? { message: "Cập nhật thành công!", status: 200 }
        : { message: "Manga không tồn tại trong thư viện.", status: 404 };
    } else {
      // Tìm hoặc tạo Manga
      await prisma.manga.upsert({
        where: { id: mangaId },
        update: {
          ...(latestChapterId !== undefined && { latestChapterId }),
          ...(title !== undefined && { title }),
          ...(coverId !== undefined && { coverId }),
        },
        create: {
          id: mangaId,
          latestChapterId: latestChapterId ?? null,
          title,
          coverId,
        },
      });

      // Thêm hoặc cập nhật Manga trong thư viện
      const existingEntry = await prisma.libraryManga.findFirst({
        where: { libraryId, mangaId },
      });

      if (existingEntry) {
        // Cập nhật category nếu đã tồn tại
        await prisma.libraryManga.update({
          where: { id: existingEntry.id },
          data: { category },
        });
      } else {
        // Tạo mới nếu chưa tồn tại
        await prisma.libraryManga.create({
          data: { libraryId, mangaId, category },
        });
      }

      return { message: "Cập nhật thành công!", status: 200 };
    }
  } catch (error) {
    console.error("Error updating manga category:", error);
    return { message: "Có lỗi xảy ra, vui lòng thử lại sau!", status: 500 };
  }
}

export type MangaLibraryEntry = {
  id: string;
  title: string | null;
  coverId: string | null;
  addedAt: Date;
};

export async function getUserLibrary(userId: string): Promise<{
  FOLLOWING: MangaLibraryEntry[];
  READING: MangaLibraryEntry[];
  PLAN: MangaLibraryEntry[];
  COMPLETED: MangaLibraryEntry[];
  DROPPED: MangaLibraryEntry[];
  RE_READING: MangaLibraryEntry[];
}> {
  const emptyResult = {
    FOLLOWING: [],
    READING: [],
    PLAN: [],
    COMPLETED: [],
    DROPPED: [],
    RE_READING: [],
  };

  try {
    // Kiểm tra xác thực
    if (!(await checkAuth(userId))) return emptyResult;

    // Tìm ID thư viện của người dùng
    const library = await prisma.library.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!library) return emptyResult;

    // Lấy tất cả Manga trong thư viện, kèm metadata và sắp xếp mới nhất trước
    const libraryMangas = await prisma.libraryManga.findMany({
      where: { libraryId: library.id },
      select: {
        mangaId: true,
        category: true,
        createdAt: true,
        manga: { select: { title: true, coverId: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Phân loại Manga theo category
    const result = libraryMangas.reduce(
      (
        acc: Record<Category, MangaLibraryEntry[]>,
        { mangaId, category, createdAt, manga },
      ) => {
        acc[category].push({
          id: mangaId,
          title: manga?.title ?? null,
          coverId: manga?.coverId ?? null,
          addedAt: createdAt,
        });
        return acc;
      },
      emptyResult as Record<Category, MangaLibraryEntry[]>,
    );

    return result;
  } catch (error) {
    console.error("Error fetching user library:", error);
    throw new Error("Failed to fetch user library.");
  }
}

export async function refreshMangaMetadata(
  userId: string,
  mangaId: string,
): Promise<{ title: string; coverId: string | null } | { error: string }> {
  try {
    if (!(await checkAuth(userId))) return { error: "Vui lòng đăng nhập lại!" };

    // Kiểm tra manga thuộc thư viện user
    const inLibrary = await prisma.libraryManga.findFirst({
      where: { mangaId, library: { userId } },
      select: { id: true },
    });
    if (!inLibrary) return { error: "Manga không có trong thư viện." };

    // Fetch từ WeebDex API
    const res = await getMangaId(mangaId);
    if (res.status !== 200 || !res.data)
      return { error: `Lỗi API: ${res.status}` };

    const manga = res.data;
    const { title } = parseMangaTitle(manga);
    const coverId = (manga as any).relationships?.cover?.id ?? null;

    // Cập nhật DB
    await prisma.manga.update({
      where: { id: mangaId },
      data: { title, coverId },
    });

    return { title, coverId };
  } catch (error) {
    console.error("Error refreshing manga metadata:", error);
    return { error: "Có lỗi xảy ra, vui lòng thử lại sau!" };
  }
}

/**
 * Chỉ lưu metadata vào DB — việc fetch API được thực hiện ở client.
 */
export async function saveMangaMetadata(
  userId: string,
  mangaId: string,
  title: string,
  coverId: string | null,
): Promise<{ message: string; status: number }> {
  try {
    if (!(await checkAuth(userId)))
      return { message: "Vui lòng đăng nhập lại!", status: 401 };

    const inLibrary = await prisma.libraryManga.findFirst({
      where: { mangaId, library: { userId } },
      select: { id: true },
    });
    if (!inLibrary)
      return { message: "Manga không có trong thư viện.", status: 404 };

    await prisma.manga.update({
      where: { id: mangaId },
      data: { title, coverId },
    });

    return { message: "Đã cập nhật!", status: 200 };
  } catch (error) {
    console.error("Error saving manga metadata:", error);
    return { message: "Có lỗi xảy ra, vui lòng thử lại sau!", status: 500 };
  }
}
