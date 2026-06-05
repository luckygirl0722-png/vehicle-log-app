import { NextRequest } from "next/server";
import { withAuth, ok, badReq, notFound, serverErr } from "@/lib/api/auth-guard";
import { VehicleUpdateSchema } from "@/lib/validations/vehicle";

type Params = { params: { id: string } };

/**
 * GET /api/vehicles/[id]
 * - 인증된 사용자 조회 가능
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { supabase, error } = await withAuth(false);
  if (error) return error;

  const { data, error: dbErr } = await supabase!
    .from("vehicles")
    .select("*")
    .eq("id", params.id)
    .single();

  if (dbErr || !data) return notFound("차량을 찾을 수 없습니다.");
  return ok(data);
}

/**
 * PATCH /api/vehicles/[id]
 * - admin 전용
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { supabase, error } = await withAuth(true);
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badReq("요청 본문이 올바르지 않습니다.");
  }

  const parsed = VehicleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return badReq(parsed.error.errors[0]?.message ?? "입력값이 올바르지 않습니다.");
  }

  if (Object.keys(parsed.data).length === 0) {
    return badReq("수정할 항목이 없습니다.");
  }

  const { data, error: dbErr } = await supabase!
    .from("vehicles")
    .update(parsed.data)
    .eq("id", params.id)
    .select()
    .single();

  if (dbErr || !data) return notFound("차량을 찾을 수 없습니다.");
  return ok(data);
}

/**
 * DELETE /api/vehicles/[id]
 * - admin 전용
 * - 소프트 삭제: is_active = false
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { supabase, error } = await withAuth(true);
  if (error) return error;

  // 연결된 운행일지 존재 여부 확인
  const { count } = await supabase!
    .from("trip_logs")
    .select("id", { count: "exact", head: true })
    .eq("vehicle_id", params.id);

  if (count && count > 0) {
    // 운행 기록이 있으면 소프트 삭제
    const { data, error: dbErr } = await supabase!
      .from("vehicles")
      .update({ is_active: false })
      .eq("id", params.id)
      .select()
      .single();

    if (dbErr || !data) return notFound("차량을 찾을 수 없습니다.");
    return ok({ ...data, _message: "운행 기록이 있어 비활성화 처리되었습니다." });
  }

  // 기록 없으면 완전 삭제
  const { error: dbErr } = await supabase!
    .from("vehicles")
    .delete()
    .eq("id", params.id);

  if (dbErr) return serverErr(dbErr.message);
  return ok({ message: "차량이 삭제되었습니다." });
}
