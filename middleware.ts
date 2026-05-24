import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

// Routes accessible without login
const PUBLIC_ROUTES = ["/login", "/api/auth"];

// Route access per role
const ROLE_ROUTES: Record<string, string[]> = {
  ADMIN: ["/dashboard", "/properties", "/reservations", "/messaging", "/cleaning", "/maintenance", "/finances", "/settings"],
  GUEST_COORDINATOR: ["/dashboard", "/reservations", "/messaging"],
  CLEANING: ["/dashboard", "/cleaning"],
  MAINTENANCE: ["/dashboard", "/maintenance"],
  FINANCE_VIEWER: ["/dashboard", "/finances"],
};

export default auth((req: NextAuthRequest) => {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Allow internal Next.js routes
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // Allow cron endpoint with secret
  if (pathname === "/api/sync/ical") {
    const authHeader = req.headers.get("authorization");
    if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.next();
    }
  }

  const session = req.auth;

  // Not logged in — redirect to login
  if (!session?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = session.user.role as string;

  // Check role access
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
