import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import TripStartForm from "./_components/TripStartForm";

// 서비스 롤 클라이언트 — RLS 우회용 (차량의 마지막 도착km 조회 시 타 운전자 기록 포함)
const adminClient = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const metadata = { title: "운행 시작 - 차량 운행일지" };

const DEFAULT_LOCATIONS = ["삼우에레코 본사", "가산동 사무소", "사무실"];

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

  // 본인에게 배정된 차량만 조회 (vehicle_drivers 기준)
  const { data: assignedVehicleRows } = await supabase
    .from("vehicle_drivers")
    .select("vehicle_id")
    .eq("driver_id", driver.id);

  const assignedIds = (assignedVehicleRows ?? []).map(r => r.vehicle_id);

  // 배정된 차량만 표시 (배정 없으면 빈 목록 → 안내 메시지)
  const { data: vehicles } = assignedIds.length > 0
    ? await supabase
        .from("vehicles").select("id, plate_number, model")
        .eq("is_active", true).in("id", assignedIds).order("plate_number")
    : { data: [] };

  if (!vehicles?.length) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-lg font-semibold">배정된 차량이 없습니다</p>
        <p className="text-sm text-muted-foreground">관리자에게 차량 배정을 요청하세요.</p>
      </div>
    );
  }

  // 차량별 마지막 도착km + 최근 출발지 — 병렬 조회
  const [{ data: lastTrips }, { data: recentLocs }] = await Promise.all([
    // ★ adminClient(서비스 롤)로 RLS 우회 → 타 운전자 포함 차량의 실제 마지막 도착km 조회
    adminClient
      .from("trip_logs").select("vehicle_id, arrival_km")
      .in("vehicle_id", assignedIds)
      .not("arrival_km", "is", null)
      .order("departure_time", { ascending: false })
      .limit(assignedIds.length * 5 + 10),
    supabase
      .from("trip_logs").select("departure_location")
      .eq("driver_id", driver.id)
      .not("departure_location", "eq", "")
      .order("departure_time", { ascending: false })
      .limit(20),
  ]);

  const lastKmMap: Record<string, number> = {};
  lastTrips?.forEach(t => {
    if (t.vehicle_id && t.arrival_km !== null && !(t.vehicle_id in lastKmMap))
      lastKmMap[t.vehicle_id] = t.arrival_km;
  });

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
