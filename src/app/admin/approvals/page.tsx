import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ApprovalClient from "./_components/ApprovalClient";
import BulkApproveButton from "./_components/BulkApproveButton";

export const metadata = { title: "승인 관리 - 차량 운행일지" };

export default async function AdminApprovalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roleRow } = await supabase
    .from("user_roles").select("role").eq("user_id", user.id).single();
  if (roleRow?.role !== "admin") redirect("/");

  const { data: trips } = await supabase
    .from("trip_logs")
    .select(`id, status, departure_time, departure_location, arrival_location,
             distance_km, toll_fee, purpose, note, departure_km, arrival_km,
             vehicles(plate_number, model), drivers(name, employee_no, department)`)
    .eq("status", "submitted")
    .order("departure_time", { ascending: true });

  const submittedIds = (trips ?? []).map(t => t.id);

  const now = new Date();
  const monthLabel = `${now.getFullYear()}년 ${now.getMonth()+1}월`;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">승인 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            승인 대기 <span className="font-semibold text-amber-600">{trips?.length ?? 0}건</span>
          </p>
        </div>
        {/* ★ 일괄 승인 버튼 */}
        <BulkApproveButton submittedIds={submittedIds} month={monthLabel} />
      </div>

      <ApprovalClient trips={(trips ?? []) as any} />
    </div>
  );
}
