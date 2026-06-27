import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * 미들웨어 — Supabase 세션 자동 갱신
 * access token 만료 시 refresh token으로 자동 재발급 → 자동 로그인 유지
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 공개 경로 — 처리 없이 통과
  const publicPaths = ["/login", "/auth/callback", "/_next", "/favicon", "/manifest", "/icons", "/sw.js"];
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // 갱신된 토큰을 요청 + 응답 쿠키 모두에 반영
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() 호출 — 만료된 access token이면 refresh token으로 자동 갱신
  const { data: { user } } = await supabase.auth.getUser();

  // 미인증 → 로그인 페이지
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // 레이아웃에서 경로 확인을 위해 pathname 헤더 전달
  supabaseResponse.headers.set("x-pathname", pathname);

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/).*)",
  ],
};
