import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, ok, badReq, notFound, serverErr } from "@/lib/api/auth-guard";
import { sendApprovalNotification, getDriverEmail } from "@/lib/email/send";

const ApproveSchema = z.object({
  action:  z.enum(["approved", "rejected"], {
    errorMap: () => ({ message: "action은 'approved' 또는 'rejected' 여야 합니다." }),
  }),
  comment: z.string().max(500).optional(),
});

type Params = { params: { id: string } };

/**
 * PATCH /api/trips/[id]/approve
 * - admin 전용
 * - submitted → approved / rejected
 * - approvals 이력 삽입 + 운전자 이메일 알림
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { supabase, user, error } = await withAuth(true);
  if (error) return error;

  const { data: trip, error: fetchErr } = await supabase!
    .from("trip_logs")
    .select("*, vehicles(plate_number), drivers(name)")
    .eq("id", params.id)
    .single();

  if (fetchErr || !trip) return notFound("운행 기록을 찾을 수 없습니다.");

  if (trip.status !== "submitted") {
    return badReq(
      `현재 상태(${trip.status})에서는 승인/반려할 수 없습니다. 승인 대기(submitted) 상태만 처리 가능합니다.`
    );
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return badReq("요청 본문이 올바르지 않습니다."); }

  const parsed = ApproveSchema.safeParse(body);
  if (!parsed.success) {
    return badReq(parsed.error.errors[0]?.message ?? "입력값이 올바르지 않습니다.");
  }

  const { action, comment } = parsed.data;

  const [tripUpdate, approvalInsert] = await Promise.all([
    supabase!.from("trip_logs")
      .update({ status: action })
      .eq("id", params.id)
      .select()
      .single(),
    supabase!.from("approvals")
      .insert({ trip_log_id: params.id, approver_id: user!.id, action, comment: comment ?? null })
      .select()
      .single(),
  ]);

  if (tripUpdate.error || !tripUpdate.data) {
    return serverErr(tripUpdate.error?.message ?? "상태 업데이트 실패");
  }

  // 이메일 알림 (fire-and-forget)
  getDriverEmail(supabase!, trip.driver_id).then(driverEmail => {
    if (!driverEmail) return;
    sendApprovalNotification({
      driverEmail,
      data: {
        driverName:   (trip.drivers as any)?.name ?? "—",
        action,
        comment:      comment ?? null,
        vehiclePlate: (trip.vehicles as any)?.plate_number ?? "—",
        depLocation:  trip.departure_location,
        arrLocation:  trip.arrival_location ?? "—",
        distanceKm:   trip.distance_km ?? 0,
        purpose:      trip.purpose,
        depTime:      trip.departure_time,
        tripId:       params.id,
      },
    });
  });

  const statusLabel = action === "approved" ? "승인" : "반려";

  return ok({
    trip:     tripUpdate.data,
    approval: approvalInsert.data,
    _message: `운행 기록이 ${statusLabel}되었습니다.`,
  });
}
