import { NextRequest } from "next/server";
import { withAuth, created, badReq, serverErr } from "@/lib/api/auth-guard";
import { z } from "zod";

const CompleteSchema = z.object({
  vehicle_id:         z.string().uuid(),
  departure_time:     z.string(),
  arrival_time:       z.string(),
  departure_location: z.string().min(1, "출발지를 입력하세요."),
  arrival_location:   z.string().min(1, "도착지를 입력하세요."),
  departure_km:       z.number().int().min(0),
  arrival_km:         z.number().int().min(0),
  toll_fee:           z.number().int().min(0).default(0),
  purpose:            z.string().min(1, "목적을 입력하세요."),
  trip_type:          z.enum(["업무", "출퇴근", "개인사용"]).default("업무"),
  note:               z.string().optional(),
});

/**
 * POST /api/trips/complete
 * 소급 입력: 출발+도착 정보를 한 번에 등록 → status: submitted
 */
export async function POST(request: NextRequest) {
  const { supabase, user, error } = await withAuth(false);
  if (error) return error;

  let body: unknown;
  try { body = await request.json(); }
  catch { return badReq("요청 본문이 올바르지 않습니다."); }

  const parsed = CompleteSchema.safeParse(body);
  if (!parsed.success) {
    return badReq(parsed.error.errors[0]?.message ?? "입력값이 올바르지 않습니다.");
  }

  const d = parsed.data;

  if (d.arrival_km < d.departure_km) {
    return badReq(`도착km(${d.arrival_km})은 출발km(${d.departure_km}) 이상이어야 합니다.`);
  }

  const depTime = new Date(d.departure_time);
  const arrTime = new Date(d.arrival_time);
  if (arrTime <= depTime) {
    return badReq("도착 시간은 출발 시간 이후여야 합니다.");
  }

  // 본인 driver 조회
  const { data: myDriver } = await supabase!
    .from("drivers").select("id").eq("user_id", user!.id).single();
  if (!myDriver) return badReq("운전자 정보를 찾을 수 없습니다.");

  const { data, error: dbErr } = await supabase!
    .from("trip_logs")
    .insert({
      vehicle_id:         d.vehicle_id,
      driver_id:          myDriver.id,
      departure_time:     d.departure_time,
      arrival_time:       d.arrival_time,
      departure_location: d.departure_location,
      arrival_location:   d.arrival_location,
      departure_km:       d.departure_km,
      arrival_km:         d.arrival_km,
      toll_fee:           d.toll_fee,
      purpose:            d.purpose,
      trip_type:          d.trip_type,
      note:               d.note ?? null,
      status:             "submitted",
    })
    .select("id, departure_time, arrival_time, distance_km")
    .single();

  if (dbErr) return serverErr(dbErr.message);
  return created(data);
}
