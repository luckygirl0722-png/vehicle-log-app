import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DriversClient from "./_components/DriversClient";

export const metadata = { title: "운전자 관리 — 차량 운행일지" };

export default async function DriversPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roleRow } = await supabase
    .from("user_roles").select("role").eq("user_id", user.id).single();
  if (roleRow?.role !== "admin") redirect("/");

  const { data: drivers } = await supabase
    .from("drivers")
    .select("*")
    .order("employee_no");

  // 운전자별 배정 차량 조회
  const { data: vehicleAssignments } = await supabase
    .from("vehicle_drivers")
    .select("driver_id, vehicles(id, plate_number, model)");

  // driver_id → 차량 목록 맵 생성
  const driverVehicleMap: Record<string, { id: string; plate_number: string; model: string }[]> = {};
  for (const row of vehicleAssignments ?? []) {
    const v = row.vehicles as { id: string; plate_number: string; model: string } | null;
    if (!v) continue;
    if (!driverVehicleMap[row.driver_id]) driverVehicleMap[row.driver_id] = [];
    driverVehicleMap[row.driver_id].push(v);
  }

  return (
    <div className="p-6">
      <DriversClient drivers={drivers ?? []} driverVehicleMap={driverVehicleMap} />
    </div>
  );
}
