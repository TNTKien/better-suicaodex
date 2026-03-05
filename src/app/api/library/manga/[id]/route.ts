import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      { message: "Vui lòng đăng nhập lại!" },
      { status: 401 },
    );
  }

  const { id } = await params;
  if (!id) {
    return Response.json({ message: "Thiếu mã truyện" }, { status: 400 });
  }

  const library = await prisma.library.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!library) {
    return Response.json(
      { message: "Thư viện không tồn tại." },
      { status: 404 },
    );
  }

  const deleteResult = await prisma.libraryManga.deleteMany({
    where: {
      libraryId: library.id,
      mangaId: id,
    },
  });

  if (!deleteResult.count) {
    return Response.json(
      { message: "Manga không tồn tại trong thư viện." },
      { status: 404 },
    );
  }

  return Response.json({ message: "Cập nhật thành công!" }, { status: 200 });
}
