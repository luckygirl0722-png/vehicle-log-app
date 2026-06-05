import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Next.js 미들웨어용 Supabase 클라이언트
 * 세션 쿠키를 요청/응답에 직접 읽고 씁니다
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
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

  // 세션 갱신 (반드시 getUser() 호출해야 토큰 자동 갱신됨)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ── 공개 경로 (인증 불필요) ──────────────────────────────
  const publicPaths = ["/login", "/auth/callback"];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  // 미인증 → /login 리다이렉트
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 인증됨 + /login 접근 → 역할에 따라 분기
  if (user && pathname === "/login") {
    // 역할 조회
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const role = roleRow?.role ?? "driver";
    const url = request.nextUrl.clone();
    url.pathname = role === "admin" ? "/admin/dashboard" : "/";
    return NextResponse.redirect(url);
  }

  // admin 전용 경로에 driver 접근 차단
  if (user && pathname.startsWith("/admin")) {
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleRow?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
