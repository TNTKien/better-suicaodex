"use server";

import { and, desc, eq } from "drizzle-orm";
import { getAuthSession } from "@/auth";
import { db } from "@/lib/db";
import {
  type Category,
  libraries,
  libraryMangas,
  mangas,
} from "@/lib/db/schema";
import { getMangaId } from "@/lib/weebdex/hooks/manga/manga";
import { parseMangaTitle } from "@/lib/weebdex/utils";

async function checkAuth(userID: string): Promise<boolean> {
  const session = await getAuthSession();
  return session?.user?.id === userID || false;
}

export async function getMangaCategory(
  userId: string,
  mangaId: string,
): Promise<string> {
  try {
    if (!(await checkAuth(userId))) return "NONE";

    const [result] = await db
      .select({ category: libraryMangas.category })
      .from(libraryMangas)
      .innerJoin(libraries, eq(libraryMangas.libraryId, libraries.id))
      .where(
        and(eq(libraryMangas.mangaId, mangaId), eq(libraries.userId, userId)),
      )
      .limit(1);

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
    if (!(await checkAuth(userId))) {
      return { message: "Vui lòng đăng nhập lại!", status: 401 };
    }

    return await db.transaction(async (tx) => {
      await tx.insert(libraries).values({ userId }).onConflictDoNothing({
        target: libraries.userId,
      });

      const [library] = await tx
        .select({ id: libraries.id })
        .from(libraries)
        .where(eq(libraries.userId, userId))
        .limit(1);

      if (!library) {
        throw new Error("Library could not be created or loaded.");
      }

      if (category === "NONE") {
        const deletedRows = await tx
          .delete(libraryMangas)
          .where(
            and(
              eq(libraryMangas.libraryId, library.id),
              eq(libraryMangas.mangaId, mangaId),
            ),
          )
          .returning({ id: libraryMangas.id });

        return deletedRows.length
          ? { message: "Cập nhật thành công!", status: 200 }
          : { message: "Manga không tồn tại trong thư viện.", status: 404 };
      }

      const mangaInsert = {
        id: mangaId,
        latestChapterId: latestChapterId ?? null,
        title: title ?? null,
        coverId: coverId ?? null,
      };
      const mangaUpdateSet: {
        latestChapterId?: string | null;
        title?: string | null;
        coverId?: string | null;
      } = {};

      if (latestChapterId !== undefined) {
        mangaUpdateSet.latestChapterId = latestChapterId;
      }

      if (title !== undefined) {
        mangaUpdateSet.title = title;
      }

      if (coverId !== undefined) {
        mangaUpdateSet.coverId = coverId;
      }

      if (Object.keys(mangaUpdateSet).length > 0) {
        await tx.insert(mangas).values(mangaInsert).onConflictDoUpdate({
          target: mangas.id,
          set: mangaUpdateSet,
        });
      } else {
        await tx.insert(mangas).values(mangaInsert).onConflictDoNothing({
          target: mangas.id,
        });
      }

      await tx
        .insert(libraryMangas)
        .values({
          libraryId: library.id,
          mangaId,
          category,
        })
        .onConflictDoUpdate({
          target: [libraryMangas.libraryId, libraryMangas.mangaId],
          set: {
            category,
            updatedAt: new Date(),
          },
        });

      return { message: "Cập nhật thành công!", status: 200 };
    });
  } catch (error) {
    console.error("Error updating manga category:", error);
    return { message: "Có lỗi xảy ra, vui lòng thử lại sau!", status: 500 };
  }
}

export interface MangaLibraryEntry {
  id: string;
  title: string | null;
  coverId: string | null;
  addedAt: Date;
}

export async function getUserLibrary(userId: string): Promise<{
  FOLLOWING: MangaLibraryEntry[];
  READING: MangaLibraryEntry[];
  PLAN: MangaLibraryEntry[];
  COMPLETED: MangaLibraryEntry[];
  DROPPED: MangaLibraryEntry[];
  RE_READING: MangaLibraryEntry[];
}> {
  const emptyResult: Record<Category, MangaLibraryEntry[]> = {
    FOLLOWING: [],
    READING: [],
    PLAN: [],
    COMPLETED: [],
    DROPPED: [],
    RE_READING: [],
  };

  try {
    if (!(await checkAuth(userId))) return emptyResult;

    const [library] = await db
      .select({ id: libraries.id })
      .from(libraries)
      .where(eq(libraries.userId, userId))
      .limit(1);

    if (!library) return emptyResult;

    const libraryEntries = await db
      .select({
        mangaId: libraryMangas.mangaId,
        category: libraryMangas.category,
        createdAt: libraryMangas.createdAt,
        title: mangas.title,
        coverId: mangas.coverId,
      })
      .from(libraryMangas)
      .innerJoin(mangas, eq(libraryMangas.mangaId, mangas.id))
      .where(eq(libraryMangas.libraryId, library.id))
      .orderBy(desc(libraryMangas.createdAt));

    const result: Record<Category, MangaLibraryEntry[]> = {
      FOLLOWING: [],
      READING: [],
      PLAN: [],
      COMPLETED: [],
      DROPPED: [],
      RE_READING: [],
    };

    for (const entry of libraryEntries) {
      result[entry.category].push({
        id: entry.mangaId,
        title: entry.title ?? null,
        coverId: entry.coverId ?? null,
        addedAt: entry.createdAt,
      });
    }

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

    const [inLibrary] = await db
      .select({ id: libraryMangas.id })
      .from(libraryMangas)
      .innerJoin(libraries, eq(libraryMangas.libraryId, libraries.id))
      .where(
        and(eq(libraryMangas.mangaId, mangaId), eq(libraries.userId, userId)),
      )
      .limit(1);

    if (!inLibrary) return { error: "Manga không có trong thư viện." };

    const res = await getMangaId(mangaId);
    if (res.status !== 200 || !res.data) {
      return { error: `Lỗi API: ${res.status}` };
    }

    const manga = res.data;
    const { title } = parseMangaTitle(manga);
    const coverId =
      (
        manga as {
          relationships?: {
            cover?: {
              id?: string | null;
            };
          };
        }
      ).relationships?.cover?.id ?? null;

    await db
      .update(mangas)
      .set({ title, coverId })
      .where(eq(mangas.id, mangaId));

    return { title, coverId };
  } catch (error) {
    console.error("Error refreshing manga metadata:", error);
    return { error: "Có lỗi xảy ra, vui lòng thử lại sau!" };
  }
}

export async function saveMangaMetadata(
  userId: string,
  mangaId: string,
  title: string,
  coverId: string | null,
): Promise<{ message: string; status: number }> {
  try {
    if (!(await checkAuth(userId))) {
      return { message: "Vui lòng đăng nhập lại!", status: 401 };
    }

    const [inLibrary] = await db
      .select({ id: libraryMangas.id })
      .from(libraryMangas)
      .innerJoin(libraries, eq(libraryMangas.libraryId, libraries.id))
      .where(
        and(eq(libraryMangas.mangaId, mangaId), eq(libraries.userId, userId)),
      )
      .limit(1);

    if (!inLibrary) {
      return { message: "Manga không có trong thư viện.", status: 404 };
    }

    await db
      .update(mangas)
      .set({ title, coverId })
      .where(eq(mangas.id, mangaId));

    return { message: "Đã cập nhật!", status: 200 };
  } catch (error) {
    console.error("Error saving manga metadata:", error);
    return { message: "Có lỗi xảy ra, vui lòng thử lại sau!", status: 500 };
  }
}
