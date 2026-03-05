import { toNextJsHandler } from "better-auth/next-js";
import { authInstance } from "@/auth";

export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(authInstance);
