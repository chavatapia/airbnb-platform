import type { NextAuthConfig } from "next-auth";

// Lightweight config — NO Prisma adapter, safe for Edge middleware
export const authConfig = {
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
    error: "/login/error",
  },
  providers: [],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
