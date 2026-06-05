import { NextRequest } from "next/server";
import { withAuth, ok, badReq, notFound, serverErr } from "@/lib/api/auth-guard";
import { sendSubmitNotification, getAdminEmails } from "@/lib/email/send";

type Params = { params: { id: string } };

/**
 * PATCH /api/trips/[id]/submit  →  운행 기록 제출 (draft → submitted)
 * 제출 성공 시 관리자에게 이메일 알림 발송
 */
export async function PATCH(_req: NextRequest, { params }: Params) {
  const { supabase, user, error } = await withAuth(false);
  if (error) return error;

  const { data: trip, error: fetchErr } = await supabase!
    .from("trip_logs")
    .select("*, vehicles(plate_number), drivers(name, department)")
    .eq("id", params.id)
    .single();

  if (fetchErr || !trip) return notFound("운행 기록을 찾을 수 없습니다.");

  if (trip.status !== "draft") {
    return badReq(`현재 상태(${trip.status})에서는 제출할 수 없습니다. draft 상태만 제출 가능합니다.`);
  }

  if (!trip.arrival_time) {
    return badReq("도착 등록이 완료된 기록만 제출할 수 있습니다.");
  }

  // 권한: driver는 본인만
  const { data: roleRow } = await supabase!
    .from("user_roles").select("role").eq("user_id", user!.id).single();

  if (roleRow?.role !== "admin") {
    const { data: myDriver } = await supabase!
      .from("drivers").select("id").eq("user_id", user!.id).single();
    if (!myDriver || myDriver.id !== trip.driver_id) {
      return badReq("본인의 운행 기록만 제출할 수 있습니다.");
    }
  }

  const { data, error: dbErr } = await supabase!
    .from("trip_logs")
    .update({ status: "submitted" })
    .eq("id", params.id)
    .select()
    .single();

  if (dbErr || !data) return serverErr(dbErr?.message ?? "제출 실패");

  // 이메일 알림 (fire-and-forget — 실패해도 제출 결과에 영향 없음)
  getAdminEmails(supabase!).then(adminEmails => {
    adminEmails.forEach(email =>
      sendSubmitNotification({
        adminEmail: email,
        data: {
          driverName:   (trip.drivers as any)?.name ?? "—",
          department:   (trip.drivers as any)?.department ?? "—",
          vehiclePlate: (trip.vehicles as any)?.plate_number ?? "—",
          depLocation:  trip.departure_location,
          arrLocation:  trip.arrival_location ?? "—",
          distanceKm:   trip.distance_km ?? 0,
          tollFee:      trip.toll_fee ?? 0,
          purpose:      trip.purpose,
          depTime:      trip.departure_time,
          tripId:       params.id,
        },
      })
    );
  });

  return ok({ ...data, _message: "운행 기록이 승인 요청되었습니다." });
}
