import { NextRequest } from "next/server";
import { withAuth, ok, badReq, serverErr } from "@/lib/api/auth-guard";

type Ctx = { params: { id: string } };

/**
 * GET /api/vehicles/[id]/drivers
 * 해당 차량에 배정된 운전자 목록 조회
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { supabase, error } = await withAuth(false);
  if (error) return error;

  const { data, error: dbErr } = await supabase!
    .from("vehicle_drivers")
    .select("id, driver_id, drivers(id, name, employee_no, department, phone)")
    .eq("vehicle_id", params.id)
    .order("created_at");

  if (dbErr) return serverErr(dbErr.message);
  return ok(data);
}

/**
 * POST /api/vehicles/[id]/drivers
 * 운전자 배정 (admin 전용)
 * body: { driver_id: string }
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { supabase, error } = await withAuth(true);
  if (error) return error;

  const { driver_id } = await request.json().catch(() => ({}));
  if (!driver_id) return badReq("driver_id가 필요합니다.");

  const { data, error: dbErr } = await supabase!
    .from("vehicle_drivers")
    .insert({ vehicle_id: params.id, driver_id })
    .select()
    .single();

  if (dbErr) {
    if (dbErr.code === "23505") return badReq("이미 배정된 운전자입니다.");
    return serverErr(dbErr.message);
  }
  return ok(data, 201);
}

/**
 * DELETE /api/vehicles/[id]/drivers
 * 운전자 배정 해제 (admin 전용)
 * body: { driver_id: string }
 */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { supabase, error } = await withAuth(true);
  if (error) return error;

  const { driver_id } = await request.json().catch(() => ({}));
  if (!driver_id) return badReq("driver_id가 필요합니다.");

  const { error: dbErr } = await supabase!
    .from("vehicle_drivers")
    .delete()
    .eq("vehicle_id", params.id)
    .eq("driver_id", driver_id);

  if (dbErr) return serverErr(dbErr.message);
  return ok({ success: true });
}
