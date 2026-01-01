import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { limiter, RateLimitError } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/comments/manga/[id]/count
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const headers = new Headers();

  try {
    const identifier = req.headers.get("x-forwarded-for") || "anonymous";
    await limiter.check(headers, 50, identifier); // 50 req/min
  } catch (err) {
    if (err instanceof RateLimitError) {
      return new NextResponse(JSON.stringify({ error: err.message }), {
        status: err.statusCode,
        headers,
      });
    }
    throw err;
  }

  const count = await prisma.mangaComment.count({
    where: { mangaId: id },
  });

  return NextResponse.json({ count });
}
