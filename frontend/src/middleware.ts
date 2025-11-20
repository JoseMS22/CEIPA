// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/publico"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

function isDashboard(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get("token")?.value || null;

  // 1) rutas públicas pasan
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // 2) rutas protegidas (/dashboard) SIN token -> redirige al login
  if (isDashboard(pathname) && !token) {
    // armamos la url del login
    const loginUrl = new URL("/login", req.url);

    // preservamos a dónde iba el usuario (path + query)
    const redirectTo = pathname + search;
    loginUrl.searchParams.set("next", redirectTo);

    return NextResponse.redirect(loginUrl);
  }

  // 3) todo lo demás pasa
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/login",
    "/publico",
  ],
};
