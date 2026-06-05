import { NextRequest } from "next/server";
import { withAuth, ok, notFound, serverErr } from "@/lib/api/auth-guard";

type Params = { params: { id: string } };

/**
 * GET /api/trips/[id]/approvals
 * 특정 운행 기록의 승인/반려 이력 조회
 * - driver: 본인 기록만 조회 가능 (RLS 처리)
 * - admin: 전체 조회 가능
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { supabase, error } = await withAuth(false);
  if (error) return error;

  // 운행 기록 존재 확인
  const { data: trip, error: tripErr } = await supabase!
    .from("trip_logs")
    .select("id, status")
    .eq("id", params.id)
    .single();

  if (tripErr || !trip) return notFound("운행 기록을 찾을 수 없습니다.");

  // 승인 이력 조회
  const { data: approvals, error: appErr } = await supabase!
    .from("approvals")
    .select(`
      id, action, comment, created_at,
      approver_id
    `)
    .eq("trip_log_id", params.id)
    .order("created_at", { ascending: false });

  if (appErr) return serverErr(appErr.message);

  return ok({ trip_status: trip.status, approvals: approvals ?? [] });
}
