import type { NextAuthConfig } from "next-auth";
import Discord from "next-auth/providers/discord";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Facebook from "next-auth/providers/facebook";

export default {
  providers: [Discord, Google, GitHub, Facebook],
  trustHost: true,
  // đặt callbacks logic ở đây để cả Middleware và App đều dùng được logic này
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
    // Middleware auth
    // authorized({ auth, request: { nextUrl } }) {
    //   const isLoggedIn = !!auth?.user;
    //   // bro sửa thành các trang cần protect nhiều thì chuyển nó thành arr rồi map
    //   const isOnProtectedPage =
    //     nextUrl.pathname.startsWith("/user") ||
    //     nextUrl.pathname.startsWith("/check-auth");
    //   const isOnLoginPage = nextUrl.pathname.startsWith("/login");

    //   if (isOnProtectedPage) {
    //     // login rồi thì pass còn chưa thì sang login page
    //     if (isLoggedIn) return true;
    //     return false;
    //   } else if (isOnLoginPage) {
    //     if (isLoggedIn) {
    //       // login rồi mà cố vào thì cho về home page
    //       return Response.redirect(new URL("/", nextUrl));
    //     }
    //   }

    //   return true;
    // },
  },
  // redirect to custom login page
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
