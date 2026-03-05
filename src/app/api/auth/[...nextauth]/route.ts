import { handlers } from "@/auth";
import type { NextRequest } from "next/server";

function withNextUrl(request: Request): NextRequest {
  const nextRequest = request as Request & { nextUrl?: URL };
  if (!nextRequest.nextUrl) {
    nextRequest.nextUrl = new URL(request.url);
  }
  return nextRequest as NextRequest;
}

export async function GET(request: Request) {
  return handlers.GET(withNextUrl(request));
}

export async function POST(request: Request) {
  return handlers.POST(withNextUrl(request));
}
