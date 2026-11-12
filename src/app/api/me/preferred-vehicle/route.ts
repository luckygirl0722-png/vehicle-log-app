import { NextRequest } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { withAuth, ok, badReq, serverErr } from "@/lib/api/auth-guard";

/**
 * PATCH /api/me/preferred-vehicle
 * 운전자 본인의 "주 사용 차량" 지정/해제 (관리자 기본 우선순위보다 우선 적용)
 * body: { vehicle_id: string | null }
 *
 * drivers 테이블은 운전자 UPDATE 권한이 없으므로 본인·배정 여부 확인 후 service role 로 갱신
 */
export async function PATCH(request: NextRequest) {
  const { user, supabase, error } = await withAuth(false);
  if (error) return error;

  const { vehicle_id } = await request.json().catch(() => ({}));
  if (vehicle_id !== null && typeof vehicle_id !== "string") return badReq("vehicle_id가 필요합니다.");

  const { data: driver } = await supabase!
    .from("drivers").select("id").eq("user_id", user!.id).single();
  if (!driver) return badReq("운전자 정보가 없습니다.");

  if (vehicle_id) {
    const { data: assigned } = await supabase!
      .from("vehicle_drivers").select("vehicle_id")
      .eq("driver_id", driver.id).eq("vehicle_id", vehicle_id).maybeSingle();
    if (!assigned) return badReq("배정되지 않은 차량입니다.");
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error: dbErr } = await admin
    .from("drivers").update({ preferred_vehicle_id: vehicle_id }).eq("id", driver.id);

  if (dbErr) {
    if (/preferred_vehicle_id/.test(dbErr.message))
      return serverErr("DB 마이그레이션(003)이 아직 적용되지 않았습니다.");
    return serverErr(dbErr.message);
  }
  return ok({ success: true, vehicle_id });
}
