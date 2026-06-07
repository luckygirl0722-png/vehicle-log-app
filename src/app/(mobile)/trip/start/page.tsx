import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TripStartForm from "./_components/TripStartForm";

export const metadata = { title: "운행 시작 - 차량 운행일지" };

const DEFAULT_LOCATIONS = ["삼우에레코 본사", "가산동 사무소"];

export default async function TripStartPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: driver } = await supabase
    .from("drivers").select("id, name").eq("user_id", user.id).single();
  if (!driver) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-lg font-semibold">운전자 등록이 필요합니다</p>
        <p className="text-sm text-muted-foreground">관리자에게 운전자 계정 연결을 요청하세요.</p>
      </div>
    );
  }

  const { data: activeTrip } = await supabase
    .from("trip_logs").select("id").eq("driver_id", driver.id)
    .is("arrival_time", null).eq("status", "draft").maybeSingle();
  if (activeTrip) redirect(`/trip/${activeTrip.id}/end`);

  const { data: vehicles } = await supabase
    .from("vehicles").select("id, plate_number, model")
    .eq("is_active", true).order("plate_number");

  if (!vehicles?.length) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-lg font-semibold">등록된 차량이 없습니다</p>
        <p className="text-sm text-muted-foreground">관리자에게 차량 등록을 요청하세요.</p>
      </div>
    );
  }

  // 차량별 마지막 도착km
  const { data: lastTrips } = await supabase
    .from("trip_logs").select("vehicle_id, arrival_km")
    .not("arrival_km", "is", null)
    .order("departure_time", { ascending: false });

  const lastKmMap: Record<string, number> = {};
  lastTrips?.forEach(t => {
    if (t.vehicle_id && t.arrival_km !== null && !(t.vehicle_id in lastKmMap))
      lastKmMap[t.vehicle_id] = t.arrival_km;
  });

  // 최근 출발지 (중복 제거, 최대 5개)
  const { data: recentLocs } = await supabase
    .from("trip_logs").select("departure_location")
    .eq("driver_id", driver.id)
    .not("departure_location", "eq", "")
    .order("departure_time", { ascending: false })
    .limit(20);

  const uniqueRecent = [...new Set(recentLocs?.map(t => t.departure_location) ?? [])].slice(0, 5);
  const quickLocations = [...new Set([...DEFAULT_LOCATIONS, ...uniqueRecent])].slice(0, 6);

  return (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold">운행 시작</h2>
        <p className="text-sm text-muted-foreground mt-1">{driver.name} 님, 출발 정보를 입력해 주세요</p>
      </div>
      <TripStartForm vehicles={vehicles} driver={driver} lastKmMap={lastKmMap} quickLocations={quickLocations} />
    </div>
  );
}
