import { type NextRequest, NextResponse } from "next/server";

/**
 * 미들웨어 — Edge Runtime 호환 단순 쿠키 기반 인증 체크
 * Supabase 클라이언트를 직접 사용하지 않아 Edge Runtime 충돌 없음
 * 실제 인증 검증은 각 페이지/레이아웃의 createClient()가 담당
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 공개 경로 — 인증 불필요
  const publicPaths = ["/login", "/auth/callback", "/_next", "/favicon", "/manifest", "/icons", "/sw.js"];
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Supabase 세션 쿠키 존재 여부 확인
  const cookies = request.cookies.getAll();
  const hasSession = cookies.some(c =>
    c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
  );

  // 미인증 → /login 리다이렉트
  if (!hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/).*)",
  ],
};
