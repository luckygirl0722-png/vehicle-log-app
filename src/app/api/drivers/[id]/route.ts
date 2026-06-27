import { NextRequest } from "next/server";
import { withAuth, ok, badReq, notFound, serverErr } from "@/lib/api/auth-guard";
import { DriverUpdateSchema } from "@/lib/validations/driver";

type Params = { params: { id: string } };

/**
 * GET /api/drivers/[id]
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { supabase, error } = await withAuth(false);
  if (error) return error;

  const { data, error: dbErr } = await supabase!
    .from("drivers")
    .select("*")
    .eq("id", params.id)
    .single();

  if (dbErr || !data) return notFound("운전자를 찾을 수 없습니다.");
  return ok(data);
}

/**
 * PATCH /api/drivers/[id]
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

  const parsed = DriverUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return badReq(parsed.error.errors[0]?.message ?? "입력값이 올바르지 않습니다.");
  }

  if (Object.keys(parsed.data).length === 0) {
    return badReq("수정할 항목이 없습니다.");
  }

  const { data, error: dbErr } = await supabase!
    .from("drivers")
    .update(parsed.data)
    .eq("id", params.id)
    .select()
    .single();

  if (dbErr || !data) return notFound("운전자를 찾을 수 없습니다.");
  return ok(data);
}

/**
 * DELETE /api/drivers/[id]
 * - admin 전용
 * - 운행 기록 있으면 소프트 삭제(is_active=false), 없으면 완전 삭제
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { supabase, error } = await withAuth(true);
  if (error) return error;

  const { count } = await supabase!
    .from("trip_logs")
    .select("id", { count: "exact", head: true })
    .eq("driver_id", params.id);

  if (count && count > 0) {
    const { data, error: dbErr } = await supabase!
      .from("drivers")
      .update({ is_active: false })
      .eq("id", params.id)
      .select()
      .single();

    if (dbErr || !data) return notFound("운전자를 찾을 수 없습니다.");
    return ok({ ...data, _message: "운행 기록이 있어 비활성화 처리되었습니다." });
  }

  const { error: dbErr } = await supabase!
    .from("drivers")
    .delete()
    .eq("id", params.id);

  if (dbErr) return serverErr(dbErr.message);
  return ok({ message: "운전자가 삭제되었습니다." });
}
