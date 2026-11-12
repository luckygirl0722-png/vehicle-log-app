import { NextRequest } from "next/server";
import { withAuth, ok, badReq, notFound, serverErr } from "@/lib/api/auth-guard";
import { VehicleUpdateSchema } from "@/lib/validations/vehicle";
import { writeAudit, diffFields } from "@/lib/audit";

type Params = { params: { id: string } };

/** 감사 로그에 전/후 값을 남기는 vehicles 필드 */
const VEHICLE_AUDIT_KEYS = [
  "plate_number", "model", "purpose", "is_active", "ownership_type", "status",
  "rental_company", "contract_start", "contract_end", "disposed_date",
] as const;

export async function GET(_req: NextRequest, { params }: Params) {
  const { supabase, error } = await withAuth(false);
  if (error) return error;

  const { data, error: dbErr } = await supabase!
    .from("vehicles").select("*").eq("id", params.id).single();

  if (dbErr || !data) return notFound("차량을 찾을 수 없습니다.");
  return ok(data);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { supabase, user, error } = await withAuth(true);
  if (error) return error;

  let body: unknown;
  try { body = await request.json(); }
  catch { return badReq("요청 본문이 올바르지 않습니다."); }

  const parsed = VehicleUpdateSchema.safeParse(body);
  if (!parsed.success) return badReq(parsed.error.errors[0]?.message ?? "입력값이 올바르지 않습니다.");
  if (Object.keys(parsed.data).length === 0) return badReq("수정할 항목이 없습니다.");

  // 상태 ↔ is_active 동기화: 운행중이 아니면(매각·반납·폐차) 운전자 앱에서 숨김
  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status) {
    update.is_active = parsed.data.status === "운행중";
    if (parsed.data.status === "운행중") update.disposed_date = null;
  }

  // 감사 로그용 변경 전 값
  const { data: before } = await supabase!
    .from("vehicles").select("*").eq("id", params.id).maybeSingle();

  const { data, error: dbErr } = await supabase!
    .from("vehicles").update(update).eq("id", params.id).select().single();

  if (dbErr || !data) {
    if (dbErr && /column .* does not exist/i.test(dbErr.message))
      return serverErr("DB 마이그레이션(003)이 아직 적용되지 않았습니다. Supabase SQL Editor에서 실행해 주세요.");
    return notFound("차량을 찾을 수 없습니다.");
  }

  // 매각·반납·폐차 처리 시: 진행 중인 사용자 이력 종료 (배정은 유지 → 과거 기록 조회 가능)
  if (parsed.data.status && parsed.data.status !== "운행중") {
    const endDate = parsed.data.disposed_date
      ?? new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
    await supabase!
      .from("vehicle_driver_history")
      .update({ end_date: endDate, note: `차량 ${parsed.data.status}` })
      .eq("vehicle_id", params.id)
      .is("end_date", null);
  }

  const statusChanged = !!parsed.data.status && before?.status !== parsed.data.status;
  await writeAudit({
    userId:   user!.id,
    action:   statusChanged ? "vehicle.status_change" : "vehicle.update",
    table:    "vehicles",
    recordId: params.id,
    detail: {
      plate_number: data.plate_number,
      changes: diffFields(before ?? {}, update, VEHICLE_AUDIT_KEYS),
    },
  });

  return ok(data);
}

/**
 * DELETE /api/vehicles/[id]
 * - admin 전용
 * - 연결된 운행 기록(trip_logs, approvals)까지 모두 삭제 후 차량 삭제
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { supabase, user, error } = await withAuth(true);
  if (error) return error;

  // 감사 로그용 삭제 전 차량 정보
  const { data: vehicle } = await supabase!
    .from("vehicles").select("plate_number, model, status").eq("id", params.id).maybeSingle();

  // 1) approvals 삭제 (trip_logs 참조, CASCADE로 자동 삭제되지만 명시적으로)
  const { data: tripIds } = await supabase!
    .from("trip_logs").select("id").eq("vehicle_id", params.id);

  if (tripIds && tripIds.length > 0) {
    const ids = tripIds.map((t: any) => t.id);
    await supabase!.from("approvals").delete().in("trip_log_id", ids);
  }

  // 2) trip_logs 삭제
  const { error: tripErr } = await supabase!
    .from("trip_logs").delete().eq("vehicle_id", params.id);
  if (tripErr) return serverErr("운행 기록 삭제 실패: " + tripErr.message);

  // 3) 차량 삭제
  const { error: vErr } = await supabase!
    .from("vehicles").delete().eq("id", params.id);
  if (vErr) return serverErr("차량 삭제 실패: " + vErr.message);

  await writeAudit({
    userId:   user!.id,
    action:   "vehicle.delete",
    table:    "vehicles",
    recordId: params.id,
    detail: {
      plate_number:       vehicle?.plate_number ?? null,
      model:              vehicle?.model ?? null,
      status:             vehicle?.status ?? null,
      deleted_trip_count: tripIds?.length ?? 0,
    },
  });

  return ok({ message: "차량과 운행 기록이 모두 삭제되었습니다." });
}
