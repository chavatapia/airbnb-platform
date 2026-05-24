import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

const PUBLIC_ROUTES = ["/login", "/api/auth"];

const ROLE_ROUTES: Record<string, string[]> = {
  ADMIN: ["/dashboard", "/properties", "/reservations", "/messaging", "/cleaning", "/maintenance", "/finances", "/settings"],
  GUEST_COORDINATOR: ["/dashboard", "/reservations", "/messaging"],
  CLEANING: ["/dashboard", "/cleaning"],
  MAINTENANCE: ["/dashboard", "/maintenance"],
  FINANCE_VIEWER: ["/dashboard", "/finances"],
};

export default auth((req: NextAuthRequest) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  if (pathname === "/api/sync/ical") {
    const authHeader = req.headers.get("authorization");
    if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.next();
    }
  }

  const session = req.auth;

  if (!session?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = session.user.role as string;
  const allowedPaths = ROLE_ROUTES[role] ?? [];
  const hasAccess = allowedPaths.some((p) => pathname.startsWith(p));

  if (!hasAccess && pathname !== "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
