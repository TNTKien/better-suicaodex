"use server";

import type { Category } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "../prisma";

async function checkAuth(userID: string): Promise<boolean> {
  const session = await auth();
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
  latestChapterId: string,
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
        where: { mangadexId: mangaId },
        update: { latestChapterId }, // Cập nhật nếu đã tồn tại
        create: { mangadexId: mangaId, latestChapterId }, // Tạo mới nếu chưa tồn tại
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

export async function getUserLibrary(userId: string): Promise<{
  FOLLOWING: string[];
  READING: string[];
  PLAN: string[];
  COMPLETED: string[];
}> {
  try {
    // Kiểm tra xác thực
    if (!(await checkAuth(userId))) {
      return { FOLLOWING: [], READING: [], PLAN: [], COMPLETED: [] };
    }

    // Tìm ID thư viện của người dùng
    const library = await prisma.library.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!library)
      return { FOLLOWING: [], READING: [], PLAN: [], COMPLETED: [] };

    // Lấy tất cả Manga trong thư viện và phân loại
    const libraryMangas = await prisma.libraryManga.findMany({
      where: { libraryId: library.id },
      select: { mangaId: true, category: true },
    });

    // Sử dụng reduce để phân loại Manga
    const result = libraryMangas.reduce(
      (acc: Record<Category, string[]>, { mangaId, category }) => {
        acc[category].push(mangaId);
        return acc;
      },
      { FOLLOWING: [], READING: [], PLAN: [], COMPLETED: [] } as Record<
        Category,
        string[]
      >,
    );

    return result;
  } catch (error) {
    console.error("Error fetching user library:", error);
    throw new Error("Failed to fetch user library.");
  }
}
