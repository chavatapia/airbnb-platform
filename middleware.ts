import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Exclude static files, login pages, auth API, and root
  matcher: [
    "/dashboard/:path*",
    "/properties/:path*",
    "/reservations/:path*",
    "/messaging/:path*",
    "/cleaning/:path*",
    "/maintenance/:path*",
    "/finances/:path*",
    "/settings/:path*",
  ],
};
