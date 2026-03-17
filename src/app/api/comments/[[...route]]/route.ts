import { handle } from "hono/vercel";
import { commentsApp } from "@/lib/hono/comments-app";

const honoHandler = handle(commentsApp);

export const runtime = "nodejs";

export const GET = honoHandler;
export const POST = honoHandler;
export const PATCH = honoHandler;
export const PUT = honoHandler;
export const DELETE = honoHandler;
export const OPTIONS = honoHandler;
