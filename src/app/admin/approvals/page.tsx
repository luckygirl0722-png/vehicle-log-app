import { createClient } from "@/lib/supabase/server";
import { redirect }     from "next/navigation";
import ApprovalClient  from "./_components/ApprovalClient";

export const metadata = { title: "승인 관리 — 차량 운행일지" };

export default async function AdminApprovalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roleRow } = await supabase
    .from("user_roles").select("role").eq("user_id", user.id).single();
  if (roleRow?.role !== "admin") redirect("/");

  // 승인 대기 목록 — submitted 상태만
  const { data: trips } = await supabase
    .from("trip_logs")
    .select(`
      id, status, departure_time, departure_location, arrival_location,
      distance_km, toll_fee, purpose, note, departure_km, arrival_km,
      vehicles(plate_number, model),
      drivers(name, employee_no, department)
    `)
    .eq("status", "submitted")
    .order("departure_time", { ascending: true });

  return (
    <div className="p-6">
      <ApprovalClient trips={(trips ?? []) as any} />
    </div>
  );
}
