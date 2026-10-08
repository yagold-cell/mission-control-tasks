import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, safeEqual, sessionToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const isLogin = request.nextUrl.pathname === "/login";

  // No APP_PASSWORD configured = the app is open. Set the variable to turn the gate back on.
  if (!process.env.APP_PASSWORD) {
    return isLogin ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (isLogin) return NextResponse.next();

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  const ok = cookie ? safeEqual(cookie, await sessionToken()) : false;
  if (ok) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!api/login|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
