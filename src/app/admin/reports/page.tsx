import { createClient } from "@/lib/supabase/server";
import { redirect }     from "next/navigation";
import ReportActions    from "./_components/ReportActions";

export const metadata = { title: "보고서 출력 — 차량 운행일지" };

export default async function AdminReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roleRow } = await supabase
    .from("user_roles").select("role").eq("user_id", user.id).single();
  if (roleRow?.role !== "admin") redirect("/");

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, plate_number, model")
    .eq("is_active", true)
    .order("plate_number");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">보고서 출력</h1>
        <p className="text-sm text-muted-foreground mt-1">
          차량운행일지를 Excel 또는 PDF 형식으로 출력합니다
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-1.5">
        <p className="font-semibold">📋 출력 대상 안내</p>
        <ul className="list-disc list-inside space-y-1 text-amber-700">
          <li><strong>승인완료</strong> 및 <strong>승인대기</strong> 상태 기록만 포함됩니다</li>
          <li>작성중(draft) 기록은 제외됩니다</li>
          <li>PDF: A4 가로 방향 · 서명란 포함</li>
          <li>Excel: Sheet1 상세 기록 + Sheet2 차량별 집계</li>
        </ul>
      </div>

      <ReportActions vehicles={vehicles ?? []} />
    </div>
  );
}
