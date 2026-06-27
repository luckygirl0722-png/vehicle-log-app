import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import VehiclesClient from "./_components/VehiclesClient";

export const metadata = { title: "차량 관리 — 차량 운행일지" };

export default async function VehiclesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roleRow } = await supabase
    .from("user_roles").select("role").eq("user_id", user.id).single();
  if (roleRow?.role !== "admin") redirect("/");

  const { data: vehicles } = await supabase
    .from("vehicles").select("*").order("plate_number");

  const { data: allDrivers } = await supabase
    .from("drivers").select("id, name, employee_no, department, phone")
    .eq("is_active", true).order("name");

  // 차량별 배정 운전자 목록
  const { data: vehicleDriverRows } = await supabase
    .from("vehicle_drivers")
    .select("vehicle_id, drivers(id, name)");

  // vehicle_id → 운전자 이름 배열 맵
  const driversByVehicle: Record<string, string[]> = {};
  vehicleDriverRows?.forEach((row: any) => {
    const vid = row.vehicle_id;
    const name = row.drivers?.name;
    if (!name) return;
    if (!driversByVehicle[vid]) driversByVehicle[vid] = [];
    driversByVehicle[vid].push(name);
  });

  return (
    <div className="p-6">
      <VehiclesClient
        vehicles={vehicles ?? []}
        allDrivers={allDrivers ?? []}
        driversByVehicle={driversByVehicle}
      />
    </div>
  );
}
