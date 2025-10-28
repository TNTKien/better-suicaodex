import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import { prisma } from "@/lib/prisma";
import authConfig from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
	adapter: PrismaAdapter(prisma),
	session: { strategy: "jwt" },
	callbacks: {
		jwt({ token, user }) {
			if (user) {
				// User is available during sign-in
				token.id = user.id;
			}

			return token;
		},
		session({ session, token }) {
			if (typeof token.id === "string") {
				session.user.id = token.id;
			}

			return session;
		},
	},
	...authConfig,
});
