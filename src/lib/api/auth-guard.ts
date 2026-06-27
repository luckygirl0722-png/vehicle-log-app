import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Route Handler용 권한 가드
 * - 미인증 → 401
 * - requireAdmin=true 이고 admin이 아닌 경우 → 403
 *
 * admin 역할 확인은 SUPABASE_SERVICE_ROLE_KEY를 사용해 RLS/JWT 만료 문제 우회
 */
export async function withAuth(requireAdmin = false) {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      supabase: null,
      error: NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 }),
    };
  }

  if (requireAdmin) {
    // service role key로 RLS 우회하여 역할 확인 (JWT 만료 등의 영향 없음)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const checkClient = serviceKey
      ? createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
      : supabase;

    const { data: roleRow } = await checkClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleRow?.role !== "admin") {
      return {
        user: null,
        supabase: null,
        error: NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 }),
      };
    }
  }

  return { user, supabase, error: null };
}

/** 표준 API 응답 헬퍼 */
export const ok      = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });
export const created = (data: unknown) =>
  NextResponse.json(data, { status: 201 });
export const badReq  = (msg: string) =>
  NextResponse.json({ error: msg }, { status: 400 });
export const notFound = (msg = "리소스를 찾을 수 없습니다.") =>
  NextResponse.json({ error: msg }, { status: 404 });
export const serverErr = (msg = "서버 오류가 발생했습니다.") =>
  NextResponse.json({ error: msg }, { status: 500 });
