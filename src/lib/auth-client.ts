import { createAuthClient } from "better-auth/react";
import { sentinelClient } from "@better-auth/infra/client";

export const authClient = createAuthClient({
  plugins: [
    sentinelClient({
      identifyUrl: process.env.BETTER_AUTH_IDENTIFY_URL,
    }),
  ],
});
