import { NextRequest } from "next/server";
import { withAuth, ok, badReq, serverErr } from "@/lib/api/auth-guard";
import { z } from "zod";

/** 차량번호 정규식: 공백 제거 후 검사 */
const plateRegex = /^\d{2,3}[가-힣]\d{4}$/;

const BulkVehicleSchema = z.array(
  z.object({
    plate_number: z
      .string()
      .transform((v) => v.replace(/\s/g, ""))
      .pipe(z.string().regex(plateRegex, "올바른 차량번호 형식이 아닙니다.")),
    model: z.string().min(1).max(50),
    purpose: z.enum(["영업용", "업무용"]).default("영업용"),
    note: z.string().max(200).optional(),
  })
).min(1, "최소 1개의 차량이 필요합니다.").max(200, "최대 200개까지 일괄 등록 가능합니다.");

/**
 * POST /api/vehicles/bulk
 * 차량 일괄 등록 (admin 전용)
 * 중복 차량번호는 건너뛰고 결과를 반환
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

  const parsed = BulkVehicleSchema.safeParse(body);
  if (!parsed.success) {
    return badReq(parsed.error.errors[0]?.message ?? "입력값이 올바르지 않습니다.");
  }

  const vehicles = parsed.data;
  const results = { inserted: 0, skipped: 0, errors: [] as string[] };
  const inserted: unknown[] = [];

  for (const v of vehicles) {
    const { data, error: dbErr } = await supabase!
      .from("vehicles")
      .insert(v)
      .select()
      .single();

    if (dbErr) {
      if (dbErr.code === "23505") {
        results.skipped++;
        results.errors.push(`${v.plate_number}: 이미 등록된 차량번호`);
      } else {
        results.errors.push(`${v.plate_number}: ${dbErr.message}`);
      }
    } else {
      results.inserted++;
      inserted.push(data);
    }
  }

  return ok({ ...results, data: inserted });
}
