import type { AuthSession } from "@/auth";

export type CommentsAppEnv = {
  Variables: {
    session: AuthSession;
  };
};
