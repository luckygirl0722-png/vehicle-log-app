import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase Auth 이메일 확인 콜백 핸들러
 * - 이메일 인증 링크 클릭 시 이 라우트로 진입
 * - 세션 교환 후 역할에 따라 분기
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get("code");
  const next  = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        const role = roleRow?.role ?? "driver";
        const destination = role === "admin" ? "/admin/dashboard" : next;
        return NextResponse.redirect(`${origin}${destination}`);
      }
    }
  }

  // 실패 시 로그인 페이지로
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
