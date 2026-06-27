import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withAuth, ok, badReq, serverErr } from "@/lib/api/auth-guard";

/**
 * POST /api/admin/set-driver-password
 * 관리자가 운전자 계정을 직접 생성하거나 비밀번호를 설정
 * body: { driver_id, email, password }
 */
export async function POST(request: NextRequest) {
  const { error } = await withAuth(true);
  if (error) return error;

  let body: { driver_id?: string; email?: string; password?: string };
  try { body = await request.json(); }
  catch { return badReq("요청 본문이 올바르지 않습니다."); }

  const { driver_id, email, password } = body;
  if (!driver_id || !email || !password) return badReq("driver_id, email, password 모두 필요합니다.");
  if (password.length < 6) return badReq("비밀번호는 6자 이상이어야 합니다.");

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 기존 계정 여부 확인
    const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const existing = users.find(u => u.email === email);

    let userId: string;
    let isNew = false;

    if (existing) {
      // 기존 계정 → 비밀번호 변경 + password_changed 플래그 초기화 (재변경 유도)
      const { error: updateErr } = await adminClient.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { password_changed: false },
      });
      if (updateErr) return serverErr(`비밀번호 변경 실패: ${updateErr.message}`);
      userId = existing.id;
    } else {
      // 신규 계정 생성 (이메일 인증 없이, 최초 변경 필요 플래그 설정)
      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { password_changed: false },
      });
      if (createErr || !created.user) return serverErr(`계정 생성 실패: ${createErr?.message}`);
      userId = created.user.id;
      isNew = true;
    }

    // drivers 테이블 연결
    const { error: driverErr } = await adminClient
      .from("drivers")
      .update({ user_id: userId, email })
      .eq("id", driver_id);
    if (driverErr) return serverErr(driverErr.message);

    // user_roles 설정
    await adminClient
      .from("user_roles")
      .upsert({ user_id: userId, role: "driver" }, { onConflict: "user_id" });

    return ok({
      message: isNew
        ? `계정이 생성되었습니다. (${email})`
        : `비밀번호가 변경되었습니다. (${email})`,
      is_new: isNew,
    });

  } catch (err: unknown) {
    return serverErr((err as Error).message ?? "서버 오류");
  }
}
