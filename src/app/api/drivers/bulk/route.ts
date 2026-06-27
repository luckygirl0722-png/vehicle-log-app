import { NextRequest } from "next/server";
import { withAuth, ok, badReq, serverErr } from "@/lib/api/auth-guard";
import { z } from "zod";

const BulkDriverSchema = z.array(
  z.object({
    employee_no: z.string().min(1).max(20),
    name: z.string().min(1).max(50),
    department: z.string().min(1).max(50),
    phone: z
      .string()
      .regex(/^010-\d{4}-\d{4}$/, "휴대폰 번호 형식 오류")
      .optional()
      .or(z.literal(""))
      .nullable(),
    license_no: z.string().max(30).optional().nullable(),
    email: z.string().email().optional().nullable(),
  })
).min(1).max(500);

/**
 * POST /api/drivers/bulk
 * 운전자 일괄 등록/업데이트 (admin 전용)
 * - 신규 사원번호: INSERT
 * - 기존 사원번호: email 포함 주요 필드 UPDATE (upsert)
 */
export async function POST(request: NextRequest) {
  const { supabase, error } = await withAuth(true);
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badReq("요청 본문이 올바르지 않습니다.");
  }

  const parsed = BulkDriverSchema.safeParse(body);
  if (!parsed.success) {
    return badReq(parsed.error.errors[0]?.message ?? "입력값이 올바르지 않습니다.");
  }

  const drivers = parsed.data;
  const results = { inserted: 0, updated: 0, errors: [] as string[] };
  const upserted: unknown[] = [];

  for (const d of drivers) {
    const payload: Record<string, unknown> = {
      employee_no: d.employee_no,
      name: d.name,
      department: d.department,
      phone: d.phone || null,
      license_no: d.license_no || null,
      email: d.email || null,
    };

    // 기존 레코드 여부 확인
    const { data: existing } = await supabase!
      .from("drivers")
      .select("id")
      .eq("employee_no", d.employee_no)
      .single();

    if (existing) {
      // 기존 운전자 → email 등 주요 필드 업데이트
      const { data, error: dbErr } = await supabase!
        .from("drivers")
        .update({ email: d.email || null, phone: d.phone || null, department: d.department })
        .eq("employee_no", d.employee_no)
        .select()
        .single();

      if (dbErr) {
        results.errors.push(`${d.name}(${d.employee_no}): ${dbErr.message}`);
      } else {
        results.updated++;
        upserted.push(data);
      }
    } else {
      // 신규 운전자 → INSERT
      const { data, error: dbErr } = await supabase!
        .from("drivers")
        .insert(payload)
        .select()
        .single();

      if (dbErr) {
        results.errors.push(`${d.name}(${d.employee_no}): ${dbErr.message}`);
      } else {
        results.inserted++;
        upserted.push(data);
      }
    }
  }

  return ok({ ...results, data: upserted });
}
