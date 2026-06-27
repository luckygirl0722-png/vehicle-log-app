import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, badReq, serverErr } from "@/lib/api/auth-guard";

/**
 * PATCH /api/auth/change-password
 * 로그인된 사용자가 비밀번호를 변경
 * body: { password: string }
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return badReq("로그인이 필요합니다.");

  let body: { password?: string };
  try { body = await request.json(); }
  catch { return badReq("요청 본문이 올바르지 않습니다."); }

  const { password } = body;
  if (!password || password.length < 6) return badReq("비밀번호는 6자 이상이어야 합니다.");

  // 비밀번호 변경 + user_metadata에 플래그 동시 저장 (RLS 우회, 즉시 반영)
  const { error } = await supabase.auth.updateUser({
    password,
    data: { password_changed: true },
  });
  if (error) return serverErr(error.message);

  // drivers 테이블도 함께 업데이트 (관리자 모니터링용, 실패해도 무시)
  await supabase
    .from("drivers")
    .update({ password_changed: true })
    .eq("user_id", user.id);

  return ok({ message: "비밀번호가 변경되었습니다.", password_changed: true });
}
