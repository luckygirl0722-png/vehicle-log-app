import { NextRequest } from "next/server";
import { withAuth, ok, created, badReq, serverErr } from "@/lib/api/auth-guard";
import { DriverCreateSchema } from "@/lib/validations/driver";

/**
 * GET /api/drivers
 * - 인증된 사용자 전체 조회 가능
 * - 쿼리: ?is_active=true|false (기본 true)
 *         ?department=영업1팀 (부서 필터)
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
  if (department) {
    query = query.eq("department", department);
  }

  const { data, error: dbErr } = await query;
  if (dbErr) return serverErr(dbErr.message);

  return ok(data);
}

/**
 * POST /api/drivers
 * - admin 전용
 */
export async function POST(request: NextRequest) {
  const { supabase, error } = await withAuth(true);
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badReq("요청 본문이 올바르지 않습니다.");
  }

  const parsed = DriverCreateSchema.safeParse(body);
  if (!parsed.success) {
    return badReq(parsed.error.errors[0]?.message ?? "입력값이 올바르지 않습니다.");
  }

  const { data, error: dbErr } = await supabase!
    .from("drivers")
    .insert(parsed.data)
    .select()
    .single();

  if (dbErr) {
    if (dbErr.code === "23505") {
      return badReq(`이미 등록된 사원번호입니다: ${parsed.data.employee_no}`);
    }
    return serverErr(dbErr.message);
  }

  return created(data);
}
