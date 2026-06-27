import { NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { withAuth, ok, created, badReq, serverErr } from "@/lib/api/auth-guard";
import { DriverCreateSchema } from "@/lib/validations/driver";

const DEFAULT_PASSWORD = "Samwoo2024!";

/**
 * GET /api/drivers
 */
export async function GET(request: NextRequest) {
  const { supabase, error } = await withAuth(false);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const isActive   = searchParams.get("is_active");
  const department = searchParams.get("department");

  let query = supabase!
    .from("drivers")
    .select("id, employee_no, name, department, phone, is_active, user_id")
    .order("employee_no");

  if (isActive !== null) {
    query = query.eq("is_active", isActive !== "false");
  } else {
    query = query.eq("is_active", true);
  }
  if (department) query = query.eq("department", department);

  const { data, error: dbErr } = await query;
  if (dbErr) return serverErr(dbErr.message);
  return ok(data);
}

/**
 * POST /api/drivers
 * - admin 전용
 * - 이메일이 있으면 Supabase Auth 계정 자동 생성 (기본 비번: Samwoo2024!)
 *   + drivers.user_id 연결 + user_roles 등록
 */
export async function POST(request: NextRequest) {
  const { supabase, error } = await withAuth(true);
  if (error) return error;

  let body: unknown;
  try { body = await request.json(); }
  catch { return badReq("요청 본문이 올바르지 않습니다."); }

  const parsed = DriverCreateSchema.safeParse(body);
  if (!parsed.success) {
    return badReq(parsed.error.errors[0]?.message ?? "입력값이 올바르지 않습니다.");
  }

  const driverData: Record<string, unknown> = { ...parsed.data };
  let newUserId: string | null = null;

  // 이메일이 있으면 Auth 계정 자동 생성
  if (parsed.data.email) {
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 기존 계정 여부 확인
    const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = users.find(u => u.email === parsed.data.email);

    if (existingUser) {
      newUserId = existingUser.id;
    } else {
      // 신규 계정 생성
      const { data: authData, error: createErr } = await adminClient.auth.admin.createUser({
        email: parsed.data.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { password_changed: false },
      });
      if (createErr || !authData.user) {
        return serverErr(`계정 생성 실패: ${createErr?.message}`);
      }
      newUserId = authData.user.id;
    }

    // user_roles 등록
    await adminClient
      .from("user_roles")
      .upsert({ user_id: newUserId, role: "driver" }, { onConflict: "user_id" });

    driverData.user_id = newUserId;
  }

  // drivers 테이블 삽입
  const { data: newDriver, error: dbErr } = await supabase!
    .from("drivers")
    .insert(driverData)
    .select()
    .single();

  if (dbErr) {
    if (dbErr.code === "23505") {
      return badReq(`이미 등록된 사원번호입니다: ${parsed.data.employee_no}`);
    }
    return serverErr(dbErr.message);
  }

  return created({
    ...newDriver,
    user_id: newUserId ?? newDriver.user_id,
    account_created: !!newUserId,
    message: newUserId
      ? `운전자 등록 완료. 초기 비밀번호: ${DEFAULT_PASSWORD}`
      : "운전자가 등록되었습니다. (이메일 미입력 — 계정 미생성)",
  });
}
