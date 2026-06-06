import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withAuth, ok, badReq, serverErr } from "@/lib/api/auth-guard";

/**
 * POST /api/admin/invite-driver
 * 운전자에게 초대 이메일 발송 + Auth 계정 생성
 * - admin 전용
 * - Supabase service_role 키 필요
 */
export async function POST(request: NextRequest) {
  const { error } = await withAuth(true);
  if (error) return error;

  let body: any;
  try { body = await request.json(); }
  catch { return badReq("요청 본문이 올바르지 않습니다."); }

  const { driver_id, email } = body;
  if (!driver_id || !email) return badReq("driver_id와 email이 필요합니다.");

  // service_role 클라이언트 (admin 권한)
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 1. 이미 Auth 계정이 있는지 확인
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      // 이미 계정 있음 → 비밀번호 재설정 링크 발송
      userId = existingUser.id;
      await adminClient.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login` },
      });
    } else {
      // 신규 → 초대 이메일 발송 (비밀번호 설정 링크 포함)
      const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` }
      );
      if (inviteErr || !inviteData.user) {
        return serverErr(`초대 발송 실패: ${inviteErr?.message}`);
      }
      userId = inviteData.user.id;
    }

    // 2. drivers 테이블에 user_id + email 연결
    const { error: updateErr } = await adminClient
      .from("drivers")
      .update({ user_id: userId, email })
      .eq("id", driver_id);

    if (updateErr) return serverErr(updateErr.message);

    // 3. user_roles에 driver 역할 부여 (없으면 insert)
    await adminClient
      .from("user_roles")
      .upsert({ user_id: userId, role: "driver" }, { onConflict: "user_id" });

    return ok({
      message: existingUser
        ? "비밀번호 재설정 이메일을 발송했습니다."
        : "초대 이메일을 발송했습니다. 운전자가 이메일 링크를 클릭하면 비밀번호를 설정할 수 있습니다.",
      is_new: !existingUser,
    });

  } catch (err: any) {
    return serverErr(err.message ?? "서버 오류");
  }
}
