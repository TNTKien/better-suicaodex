import { HttpStatusEnum } from "elysia-http-status-code/status";

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T | null;
  error: {
    code: string;
    details?: Array<{ field?: string; message: string }>;
  } | null;
}

export class RateLimitError extends Error {
  constructor(
    public message: string = "rate-limited",
    public detail: string = "",
    public status: number = HttpStatusEnum.HTTP_429_TOO_MANY_REQUESTS // or just 429
  ) {
    super(message);
  }
}
