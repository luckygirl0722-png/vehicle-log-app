import { NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { withAuth, ok, badReq, notFound, serverErr } from "@/lib/api/auth-guard";
import { TripUpdateSchema } from "@/lib/validations/trip";

type Params = { params: { id: string } };

/**
 * GET /api/trips/[id]
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { supabase, error } = await withAuth(false);
  if (error) return error;

  const { data, error: dbErr } = await supabase!
    .from("trip_logs")
    .select(`*, vehicles(plate_number, model), drivers(name, employee_no)`)
    .eq("id", params.id)
    .single();

  if (dbErr || !data) return notFound("운행 기록을 찾을 수 없습니다.");
  return ok(data);
}

/**
 * PATCH /api/trips/[id]
 * - draft 상태만 수정 가능
 * - driver는 본인 기록만, admin은 전체
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { supabase, user, error } = await withAuth(false);
  if (error) return error;

  // 기존 기록 조회
  const { data: existing, error: fetchErr } = await supabase!
    .from("trip_logs").select("*").eq("id", params.id).single();

  if (fetchErr || !existing) return notFound("운행 기록을 찾을 수 없습니다.");

  // draft 상태 확인
  if (existing.status !== "draft") {
    return badReq("제출된 기록은 수정할 수 없습니다. 반려 후 수정이 가능합니다.");
  }

  // 권한 확인: driver는 본인만
  const { data: roleRow } = await supabase!
    .from("user_roles").select("role").eq("user_id", user!.id).single();

  if (roleRow?.role !== "admin") {
    const { data: myDriver } = await supabase!
      .from("drivers").select("id").eq("user_id", user!.id).single();
    if (!myDriver || myDriver.id !== existing.driver_id) {
      return badReq("본인의 운행 기록만 수정할 수 있습니다.");
    }
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return badReq("요청 본문이 올바르지 않습니다."); }

  const parsed = TripUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return badReq(parsed.error.errors[0]?.message ?? "입력값이 올바르지 않습니다.");
  }

  if (Object.keys(parsed.data).length === 0) return badReq("수정할 항목이 없습니다.");

  // arrival_km 수정 시 departure_km 이상인지 검증
  const newArrivalKm = parsed.data.arrival_km ?? existing.arrival_km;
  const newDepartureKm = parsed.data.departure_km ?? existing.departure_km;
  if (newArrivalKm !== null && newArrivalKm < newDepartureKm) {
    return badReq("도착 km는 출발 km 이상이어야 합니다.");
  }

  const { data, error: dbErr } = await supabase!
    .from("trip_logs")
    .update(parsed.data)
    .eq("id", params.id)
    .select(`*, vehicles(plate_number), drivers(name)`)
    .single();

  if (dbErr || !data) return serverErr(dbErr?.message ?? "수정 실패");
  return ok(data);
}

/**
 * DELETE /api/trips/[id]
 * - admin: 모든 상태 삭제 가능 (RLS 우회 위해 service role 사용)
 * - driver: draft 상태 + 본인 기록만 삭제 가능
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { supabase, user, error } = await withAuth(false);
  if (error) return error;

  const { data: existing, error: fetchErr } = await supabase!
    .from("trip_logs").select("*").eq("id", params.id).single();

  if (fetchErr || !existing) return notFound("운행 기록을 찾을 수 없습니다.");

  const { data: roleRow } = await supabase!
    .from("user_roles").select("role").eq("user_id", user!.id).single();

  const isAdmin = roleRow?.role === "admin";

  if (!isAdmin) {
    // 운전자: draft 상태 + 본인 기록만
    if (existing.status !== "draft") {
      return badReq("draft 상태의 기록만 삭제할 수 있습니다.");
    }
    const { data: myDriver } = await supabase!
      .from("drivers").select("id").eq("user_id", user!.id).single();
    if (!myDriver || myDriver.id !== existing.driver_id) {
      return badReq("본인의 운행 기록만 삭제할 수 있습니다.");
    }
  }

  // 관리자는 서비스 롤로 RLS 우회 삭제 (submitted/approved 등 모든 상태)
  const deleteClient = isAdmin
    ? createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
    : supabase!;

  // 승인 기록이 있으면 먼저 삭제 (FK 제약)
  await deleteClient.from("trip_approvals").delete().eq("trip_id", params.id);

  const { error: dbErr } = await deleteClient
    .from("trip_logs").delete().eq("id", params.id);

  if (dbErr) return serverErr(dbErr.message);
  return ok({ message: "운행 기록이 삭제되었습니다." });
}
