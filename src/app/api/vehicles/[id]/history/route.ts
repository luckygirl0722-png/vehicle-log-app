import { NextRequest } from "next/server";
import { withAuth, ok, serverErr } from "@/lib/api/auth-guard";

type Ctx = { params: { id: string } };

/**
 * GET /api/vehicles/[id]/history
 * 차량 사용자(운전자) 변경 이력 — 최근 시작일 순
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { supabase, error } = await withAuth(true);
  if (error) return error;

  const { data, error: dbErr } = await supabase!
    .from("vehicle_driver_history")
    .select("id, driver_id, start_date, end_date, note, drivers(name, department)")
    .eq("vehicle_id", params.id)
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (dbErr) {
    // 003 마이그레이션 전 — 빈 이력으로 응답
    if (/vehicle_driver_history/.test(dbErr.message)) return ok([]);
    return serverErr(dbErr.message);
  }
  return ok(data);
}
