import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  basePath: "/api/auth",
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
