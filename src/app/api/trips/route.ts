import { NextRequest } from "next/server";
import { withAuth, ok, created, badReq, serverErr } from "@/lib/api/auth-guard";
import { TripStartSchema, TripListQuerySchema } from "@/lib/validations/trip";

/**
 * GET /api/trips
 * - driver: 본인 기록만 (RLS가 처리)
 * - admin: 전체 (RLS가 처리)
 * - 쿼리: driver_id, vehicle_id, status, year, month, page, limit
 */
export async function GET(request: NextRequest) {
  const { supabase, user, error } = await withAuth(false);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const rawQuery = Object.fromEntries(searchParams.entries());

  const parsed = TripListQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return badReq(parsed.error.errors[0]?.message ?? "쿼리 파라미터가 올바르지 않습니다.");
  }

  const { driver_id, vehicle_id, status, year, month, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  let query = supabase!
    .from("trip_logs")
    .select(
      `id, vehicle_id, driver_id, departure_time, departure_location, departure_km,
       arrival_time, arrival_location, arrival_km, distance_km,
       purpose, toll_fee, status, note, created_at, updated_at,
       vehicles(plate_number, model),
       drivers(name, employee_no)`,
      { count: "exact" }
    )
    .order("departure_time", { ascending: false })
    .range(offset, offset + limit - 1);

  // 필터 적용
  if (driver_id)  query = query.eq("driver_id", driver_id);
  if (vehicle_id) query = query.eq("vehicle_id", vehicle_id);
  if (status)     query = query.eq("status", status);

  // 월별 필터
  if (year && month) {
    const from = new Date(year, month - 1, 1).toISOString();
    const to   = new Date(year, month, 1).toISOString();
    query = query.gte("departure_time", from).lt("departure_time", to);
  } else if (year) {
    const from = new Date(year, 0, 1).toISOString();
    const to   = new Date(year + 1, 0, 1).toISOString();
    query = query.gte("departure_time", from).lt("departure_time", to);
  }

  const { data, error: dbErr, count } = await query;
  if (dbErr) return serverErr(dbErr.message);

  return ok({
    data,
    pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
  });
}

/**
 * POST /api/trips  →  출발 등록
 * - driver는 본인 driver_id만 허용
 * - admin은 모든 driver_id 허용
 */
export async function POST(request: NextRequest) {
  const { supabase, user, error } = await withAuth(false);
  if (error) return error;

  let body: unknown;
  try { body = await request.json(); }
  catch { return badReq("요청 본문이 올바르지 않습니다."); }

  const parsed = TripStartSchema.safeParse(body);
  if (!parsed.success) {
    return badReq(parsed.error.errors[0]?.message ?? "입력값이 올바르지 않습니다.");
  }

  // 역할 조회
  const { data: roleRow } = await supabase!
    .from("user_roles").select("role").eq("user_id", user!.id).single();
  const isAdmin = roleRow?.role === "admin";

  // driver가 타인 driver_id로 기록 생성 시도 차단
  if (!isAdmin) {
    const { data: myDriver } = await supabase!
      .from("drivers").select("id").eq("user_id", user!.id).single();
    if (!myDriver || myDriver.id !== parsed.data.driver_id) {
      return badReq("본인의 운전자 기록만 등록할 수 있습니다.");
    }
  }

  // 이미 진행 중인 운행 확인 (driver당 동시 1건만 허용)
  const { count: ongoingCount } = await supabase!
    .from("trip_logs")
    .select("id", { count: "exact", head: true })
    .eq("driver_id", parsed.data.driver_id)
    .is("arrival_time", null)
    .eq("status", "draft");

  if ((ongoingCount ?? 0) > 0) {
    return badReq("이미 진행 중인 운행이 있습니다. 도착 등록 후 새 운행을 시작하세요.");
  }

  const insertData = {
    ...parsed.data,
    departure_time: parsed.data.departure_time ?? new Date().toISOString(),
    status: "draft" as const,
  };

  const { data, error: dbErr } = await supabase!
    .from("trip_logs")
    .insert(insertData)
    .select(`*, vehicles(plate_number), drivers(name)`)
    .single();

  if (dbErr) return serverErr(dbErr.message);
  return created(data);
}
