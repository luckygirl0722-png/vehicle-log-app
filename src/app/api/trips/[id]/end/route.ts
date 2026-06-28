import { NextRequest } from "next/server";
import { withAuth, ok, badReq, notFound, serverErr } from "@/lib/api/auth-guard";
import { TripEndSchema } from "@/lib/validations/trip";

type Params = { params: { id: string } };

/**
 * PATCH /api/trips/[id]/end  →  도착 등록
 *
 * 비즈니스 규칙:
 * - 이미 도착 등록된 기록에는 재등록 불가
 * - arrival_km >= departure_km 검증 (DB 제약 + 앱 레이어 이중 검증)
 * - distance_km는 DB GENERATED ALWAYS AS STORED가 자동 계산
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { supabase, user, error } = await withAuth(false);
  if (error) return error;

  // 기존 기록 조회
  const { data: trip, error: fetchErr } = await supabase!
    .from("trip_logs").select("*").eq("id", params.id).single();

  if (fetchErr || !trip) return notFound("운행 기록을 찾을 수 없습니다.");

  // 이미 도착 등록됨
  if (trip.arrival_time !== null) {
    return badReq("이미 도착 등록된 운행 기록입니다.");
  }

  // draft 상태 확인
  if (trip.status !== "draft") {
    return badReq("진행 중인(draft) 운행만 도착 등록할 수 있습니다.");
  }

  // 권한: driver는 본인만
  const { data: roleRow } = await supabase!
    .from("user_roles").select("role").eq("user_id", user!.id).single();

  if (roleRow?.role !== "admin") {
    const { data: myDriver } = await supabase!
      .from("drivers").select("id").eq("user_id", user!.id).single();
    if (!myDriver || myDriver.id !== trip.driver_id) {
      return badReq("본인의 운행 기록만 도착 등록할 수 있습니다.");
    }
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return badReq("요청 본문이 올바르지 않습니다."); }

  const parsed = TripEndSchema.safeParse(body);
  if (!parsed.success) {
    return badReq(parsed.error.errors[0]?.message ?? "입력값이 올바르지 않습니다.");
  }

  // 앱 레이어 km 검증 (DB CHECK 이중 방어)
  if (parsed.data.arrival_km < trip.departure_km) {
    return badReq(
      `도착 km(${parsed.data.arrival_km})는 출발 km(${trip.departure_km}) 이상이어야 합니다.`
    );
  }

  const arrivalTime = parsed.data.arrival_time ?? new Date().toISOString();

  // 도착 시간 > 출발 시간 검증
  if (new Date(arrivalTime) <= new Date(trip.departure_time)) {
    return badReq(
      `도착 시간이 출발 시간(${new Date(trip.departure_time).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })})보다 이후여야 합니다.`
    );
  }

  const updateData = {
    arrival_location: parsed.data.arrival_location,
    arrival_km:       parsed.data.arrival_km,
    toll_fee:         parsed.data.toll_fee,
    arrival_time:     arrivalTime,
    note:             parsed.data.note,
  };

  const { data, error: dbErr } = await supabase!
    .from("trip_logs")
    .update(updateData)
    .eq("id", params.id)
    .select(`*, vehicles(plate_number, model), drivers(name, employee_no)`)
    .single();

  if (dbErr || !data) return serverErr(dbErr?.message ?? "도착 등록 실패");

  // 계산된 운행거리 포함하여 반환
  return ok({
    ...data,
    _computed: {
      distance_km: data.distance_km,
      message: `운행 완료: ${data.distance_km ?? 0}km 운행하셨습니다.`,
    },
  });
}
