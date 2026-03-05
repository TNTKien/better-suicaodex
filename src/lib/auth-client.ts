import { createAuthClient } from "better-auth/react";
import { sentinelClient } from "@better-auth/infra/client";

export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [sentinelClient()],
});

export const { signIn, signOut, signUp } = authClient;

export function useSession() {
  const session = authClient.useSession();

  return {
    ...session,
    data: session.data
      ? {
          ...session.data.session,
          user: session.data.user,
        }
      : null,
  };
}
