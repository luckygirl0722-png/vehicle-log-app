import { createClient as createServiceClient } from "@supabase/supabase-js";
import MonthCloseGrid from "./_components/MonthCloseGrid";

export const dynamic = "force-dynamic";
export const metadata = { title: "월별 마감 관리 — 차량 운행일지" };

const adminClient = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function MonthClosePage() {
  // 최근 13개월 목록 생성
  const now = new Date();
  const months: { year: number; month: number }[] = [];
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  // 마감 내역 조회
  const { data: closings } = await adminClient
    .from("monthly_closings")
    .select("year, month, closed_at");

  const closingSet = new Map(
    (closings ?? []).map(c => [`${c.year}-${c.month}`, c.closed_at as string])
  );

  // 월별 운행 건수 조회 (최근 13개월)
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 12, 1).toISOString();
  const { data: allTrips } = await adminClient
    .from("trip_logs")
    .select("departure_time")
    .gte("departure_time", rangeStart);

  const countMap: Record<string, number> = {};
  allTrips?.forEach(t => {
    const d   = new Date(t.departure_time);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    countMap[key] = (countMap[key] ?? 0) + 1;
  });

  const rows = months.map(m => {
    const key      = `${m.year}-${m.month}`;
    const closedAt = closingSet.get(key) ?? null;
    return {
      year:     m.year,
      month:    m.month,
      count:    countMap[key] ?? 0,
      isClosed: closingSet.has(key),
      closedAt,
    };
  });

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold">월별 마감 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          마감된 월은 운전자 앱에서 Excel 업로드 및 기록 제출이 차단됩니다.
        </p>
      </div>

      {/* 안내 */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 mb-5">
        <p className="font-semibold">⚠️ 마감 처리 유의사항</p>
        <ul className="mt-1 space-y-0.5 text-xs list-disc list-inside">
          <li>마감 후 해당 월 Excel 업로드, 신규 기록 제출이 차단됩니다.</li>
          <li>이미 등록된 기록은 마감과 무관하게 유지됩니다.</li>
          <li>마감 해제는 언제든지 가능합니다.</li>
        </ul>
      </div>

      <MonthCloseGrid months={rows} />
    </div>
  );
}
