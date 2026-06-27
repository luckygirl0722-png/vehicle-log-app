import { NextRequest } from "next/server";
import { withAuth, ok, badReq, notFound, serverErr } from "@/lib/api/auth-guard";
import { VehicleUpdateSchema } from "@/lib/validations/vehicle";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const { supabase, error } = await withAuth(false);
  if (error) return error;

  const { data, error: dbErr } = await supabase!
    .from("vehicles").select("*").eq("id", params.id).single();

  if (dbErr || !data) return notFound("차량을 찾을 수 없습니다.");
  return ok(data);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { supabase, error } = await withAuth(true);
  if (error) return error;

  let body: unknown;
  try { body = await request.json(); }
  catch { return badReq("요청 본문이 올바르지 않습니다."); }

  const parsed = VehicleUpdateSchema.safeParse(body);
  if (!parsed.success) return badReq(parsed.error.errors[0]?.message ?? "입력값이 올바르지 않습니다.");
  if (Object.keys(parsed.data).length === 0) return badReq("수정할 항목이 없습니다.");

  const { data, error: dbErr } = await supabase!
    .from("vehicles").update(parsed.data).eq("id", params.id).select().single();

  if (dbErr || !data) return notFound("차량을 찾을 수 없습니다.");
  return ok(data);
}

/**
 * DELETE /api/vehicles/[id]
 * - admin 전용
 * - 연결된 운행 기록(trip_logs, approvals)까지 모두 삭제 후 차량 삭제
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { supabase, error } = await withAuth(true);
  if (error) return error;

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

  return ok({ message: "차량과 운행 기록이 모두 삭제되었습니다." });
}
