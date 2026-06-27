import { NextRequest } from "next/server";
import { withAuth, ok, created, badReq, serverErr } from "@/lib/api/auth-guard";
import { VehicleCreateSchema } from "@/lib/validations/vehicle";

/**
 * GET /api/vehicles
 * - 인증된 사용자 전체 조회 가능
 * - 쿼리: ?is_active=true|false (기본 true)
 */
export async function GET(request: NextRequest) {
  const { supabase, error } = await withAuth(false);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const isActive = searchParams.get("is_active");

  let query = supabase!.from("vehicles").select("*").order("plate_number");
  if (isActive !== null) {
    query = query.eq("is_active", isActive !== "false");
  } else {
    query = query.eq("is_active", true);
  }

  const { data, error: dbErr } = await query;
  if (dbErr) return serverErr(dbErr.message);

  return ok(data);
}

/**
 * POST /api/vehicles
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

  const parsed = VehicleCreateSchema.safeParse(body);
  if (!parsed.success) {
    return badReq(parsed.error.errors[0]?.message ?? "입력값이 올바르지 않습니다.");
  }

  const { data, error: dbErr } = await supabase!
    .from("vehicles")
    .insert(parsed.data)
    .select()
    .single();

  if (dbErr) {
    // 중복 차량번호 처리
    if (dbErr.code === "23505") {
      return badReq(`이미 등록된 차량번호입니다: ${parsed.data.plate_number}`);
    }
    return serverErr(dbErr.message);
  }

  return created(data);
}
