import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * 감사 로그(audit_logs) 기록 헬퍼
 *
 * - audit_logs 는 RLS 상 "관리자 SELECT" 정책만 있으므로 insert 는 service role 로 수행
 * - 기록 실패가 본 요청을 실패시키지 않도록 예외를 삼키고 console.error 만 남김
 * - detail 에는 변경 전/후 핵심 값(status, km, driver_id 등)만 — 이메일·전화·비밀번호 등 개인정보 금지
 */
export type AuditAction =
  | "trip.update"
  | "trip.delete"
  | "trip.submit"
  | "trip.approve"
  | "trip.reject"
  | "vehicle.update"
  | "vehicle.status_change"
  | "vehicle.delete"
  | "vehicle_driver.assign"
  | "vehicle_driver.unassign"
  | "vehicle_driver.priority_change"
  | "driver.password_reset"
  | "driver.account_create";

export interface AuditEntry {
  userId: string | null | undefined;
  action: AuditAction;
  table: string;
  recordId?: string | null;
  detail?: Record<string, unknown> | null;
}

export async function writeAudit({ userId, action, table, recordId, detail }: AuditEntry): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error("[audit] SUPABASE_SERVICE_ROLE_KEY 미설정 — 감사 로그 생략:", action);
      return;
    }
    const admin = createAdminClient(url, key, { auth: { persistSession: false } });
    const { error } = await admin.from("audit_logs").insert({
      user_id:    userId ?? null,
      action,
      table_name: table,
      record_id:  recordId ?? null,
      detail:     detail ?? null,
    });
    if (error) console.error("[audit] insert 실패:", action, error.message);
  } catch (err) {
    console.error("[audit] 예외:", action, (err as Error)?.message ?? err);
  }
}

/** 두 객체에서 지정한 키 중 값이 달라진 항목만 { key: { before, after } } 로 추출 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: readonly string[],
): Record<string, { before: unknown; after: unknown }> {
  const out: Record<string, { before: unknown; after: unknown }> = {};
  for (const k of keys) {
    if (!(k in after)) continue;
    const b = before[k] ?? null;
    const a = after[k] ?? null;
    if (b !== a) out[k] = { before: b, after: a };
  }
  return out;
}
