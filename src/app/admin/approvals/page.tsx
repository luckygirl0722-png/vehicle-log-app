import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ApprovalClient from "./_components/ApprovalClient";

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
    .select(`id, status, trip_type, departure_time, departure_location, arrival_location,
             distance_km, toll_fee, purpose, note, departure_km, arrival_km,
             vehicle_id, driver_id,
             vehicles(id, plate_number, model), drivers(id, name, employee_no, department)`)
    .eq("status", "submitted")
    .order("departure_time", { ascending: true });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">승인 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          승인 대기 <span className="font-semibold text-amber-600">{trips?.length ?? 0}건</span>
        </p>
      </div>
      <ApprovalClient trips={(trips ?? []) as any} />
    </div>
  );
}
