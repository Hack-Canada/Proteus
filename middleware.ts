import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

const authPages = ["/login", "/auth-error"];

function isAuthenticated(request: NextRequest): boolean {
  const token = request.cookies.get(SESSION_COOKIE_NAME);
  return !!token;
}
// TODO: add a rate limiter for api or server-side routes.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // If the user is authenticated and trying to access an auth page, redirect to dashboard
  if (isAuthenticated(req) && authPages.includes(pathname)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // If the user is not authenticated and trying to access a protected route, redirect to login
  const isPublicAsset =
    pathname === "/opengraph-image" ||
    pathname === "/icon" ||
    pathname === "/apple-icon";

  if (
    !isAuthenticated(req) &&
    !authPages.includes(pathname) &&
    !isPublicAsset &&
    !pathname.startsWith("/reset-password/")
  ) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Otherwise, allow the request to continue
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!static|favicon.ico|_next|.*\\..*|api|trpc).*)", "/"],
};
