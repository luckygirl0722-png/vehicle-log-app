import { NextRequest } from "next/server";
import { withAuth, ok, badReq, serverErr } from "@/lib/api/auth-guard";
import { writeAudit } from "@/lib/audit";

type Ctx = { params: { id: string } };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** 오늘(KST) YYYY-MM-DD */
const todayKst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

/**
 * GET /api/vehicles/[id]/drivers
 * 해당 차량에 배정된 운전자 목록 (우선순위 포함)
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { supabase, error } = await withAuth(false);
  if (error) return error;

  let res = await supabase!
    .from("vehicle_drivers")
    .select("id, driver_id, priority, drivers(id, name, employee_no, department, phone)")
    .eq("vehicle_id", params.id)
    .order("created_at");

  // 003 마이그레이션 전이면 priority 없이 재조회
  if (res.error && /priority/.test(res.error.message)) {
    res = await supabase!
      .from("vehicle_drivers")
      .select("id, driver_id, drivers(id, name, employee_no, department, phone)")
      .eq("vehicle_id", params.id)
      .order("created_at") as typeof res;
  }

  if (res.error) return serverErr(res.error.message);
  return ok(res.data);
}

/**
 * POST /api/vehicles/[id]/drivers
 * 운전자 배정 (admin 전용) + 사용자 변경 이력 기록
 * body: { driver_id: string, start_date?: "YYYY-MM-DD", priority?: number, note?: string }
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { supabase, user, error } = await withAuth(true);
  if (error) return error;

  const { driver_id, start_date, priority, note } = await request.json().catch(() => ({}));
  if (!driver_id) return badReq("driver_id가 필요합니다.");
  if (start_date && !DATE_RE.test(start_date)) return badReq("시작일 형식은 YYYY-MM-DD 입니다.");

  const row: Record<string, unknown> = { vehicle_id: params.id, driver_id };
  if (Number.isInteger(priority) && priority > 0) row.priority = priority;

  const { data, error: dbErr } = await supabase!
    .from("vehicle_drivers").insert(row).select().single();

  if (dbErr) {
    if (dbErr.code === "23505") return badReq("이미 배정된 운전자입니다.");
    return serverErr(dbErr.message);
  }

  // 이력 기록 (마이그레이션 전이면 조용히 건너뜀)
  await supabase!.from("vehicle_driver_history").insert({
    vehicle_id: params.id,
    driver_id,
    start_date: start_date || todayKst(),
    note: note || null,
  });

  await writeAudit({
    userId:   user!.id,
    action:   "vehicle_driver.assign",
    table:    "vehicle_drivers",
    recordId: data?.id ?? null,
    detail: {
      vehicle_id: params.id,
      driver_id,
      start_date: start_date || todayKst(),
      priority:   row.priority ?? null,
    },
  });

  return ok(data, 201);
}

/**
 * PATCH /api/vehicles/[id]/drivers
 * 운전자별 차량 우선순위 변경 (admin 전용)
 * body: { driver_id: string, priority: number }
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { supabase, user, error } = await withAuth(true);
  if (error) return error;

  const { driver_id, priority } = await request.json().catch(() => ({}));
  if (!driver_id) return badReq("driver_id가 필요합니다.");
  if (!Number.isInteger(priority) || priority < 1 || priority > 9)
    return badReq("우선순위는 1~9 사이 정수입니다.");

  const { data: before } = await supabase!
    .from("vehicle_drivers")
    .select("id, priority")
    .eq("vehicle_id", params.id)
    .eq("driver_id", driver_id)
    .maybeSingle();

  const { error: dbErr } = await supabase!
    .from("vehicle_drivers")
    .update({ priority })
    .eq("vehicle_id", params.id)
    .eq("driver_id", driver_id);

  if (dbErr) return serverErr(dbErr.message);

  await writeAudit({
    userId:   user!.id,
    action:   "vehicle_driver.priority_change",
    table:    "vehicle_drivers",
    recordId: before?.id ?? null,
    detail: {
      vehicle_id: params.id,
      driver_id,
      priority: { before: before?.priority ?? null, after: priority },
    },
  });

  return ok({ success: true });
}

/**
 * DELETE /api/vehicles/[id]/drivers
 * 운전자 배정 해제 (admin 전용) + 이력 종료일 기록
 * body: { driver_id: string, end_date?: "YYYY-MM-DD", note?: string }
 */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { supabase, user, error } = await withAuth(true);
  if (error) return error;

  const { driver_id, end_date, note } = await request.json().catch(() => ({}));
  if (!driver_id) return badReq("driver_id가 필요합니다.");
  if (end_date && !DATE_RE.test(end_date)) return badReq("종료일 형식은 YYYY-MM-DD 입니다.");

  const { error: dbErr } = await supabase!
    .from("vehicle_drivers")
    .delete()
    .eq("vehicle_id", params.id)
    .eq("driver_id", driver_id);

  if (dbErr) return serverErr(dbErr.message);

  const upd: Record<string, unknown> = { end_date: end_date || todayKst() };
  if (note) upd.note = note;
  await supabase!
    .from("vehicle_driver_history")
    .update(upd)
    .eq("vehicle_id", params.id)
    .eq("driver_id", driver_id)
    .is("end_date", null);

  await writeAudit({
    userId: user!.id,
    action: "vehicle_driver.unassign",
    table:  "vehicle_drivers",
    detail: { vehicle_id: params.id, driver_id, end_date: upd.end_date },
  });

  return ok({ success: true });
}
