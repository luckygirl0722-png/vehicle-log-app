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

  // 주 사용 차량 (003 마이그레이션 컬럼 — 미적용 시 null)
  const { data: prefRow } = driver
    ? await adminClient.from("drivers").select("preferred_vehicle_id").eq("id", driver.id).maybeSingle()
    : { data: null };
  const preferredVehicleId: string | null = (prefRow as any)?.preferred_vehicle_id ?? null;
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
  // 우선순위(priority) 포함 조회 — 003 마이그레이션 전이면 priority 없이 재조회
  let { data: assignedVehicleRows, error: vdErr } = await supabase
    .from("vehicle_drivers")
    .select("vehicle_id, priority")
    .eq("driver_id", driver.id);
  if (vdErr) {
    ({ data: assignedVehicleRows } = await supabase
      .from("vehicle_drivers").select("vehicle_id").eq("driver_id", driver.id) as any);
  }
  const priorityMap: Record<string, number> = {};
  (assignedVehicleRows ?? []).forEach((r: any) => { priorityMap[r.vehicle_id] = r.priority ?? 1; });

  const assignedIds = (assignedVehicleRows ?? []).map(r => r.vehicle_id);

  // 배정된 차량만 표시 (배정 없으면 빈 목록 → 안내 메시지)
  const { data: vehiclesRaw } = assignedIds.length > 0
    ? await supabase
        .from("vehicles").select("id, plate_number, model")
        .eq("is_active", true).in("id", assignedIds).order("plate_number")
    : { data: [] };

  // 정렬: ① 운전자 지정 주 사용 차량 → ② 관리자 우선순위 → ③ 차량번호
  const vehicles = (vehiclesRaw ?? []).slice().sort((a, b) => {
    if (a.id === preferredVehicleId) return -1;
    if (b.id === preferredVehicleId) return 1;
    const pa = priorityMap[a.id] ?? 99, pb = priorityMap[b.id] ?? 99;
    return pa !== pb ? pa - pb : a.plate_number.localeCompare(b.plate_number);
  });

  if (!vehicles.length) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-lg font-semibold">배정된 차량이 없습니다</p>
        <p className="text-sm text-muted-foreground">관리자에게 차량 배정을 요청하세요.</p>
      </div>
    );
  }

  // 차량별 마지막 도착km + 최근 출발지 — 병렬 조회
  const [lastTrips, { data: recentLocs }] = await Promise.all([
    // ★ adminClient(서비스 롤)로 RLS 우회 → 타 운전자 포함 차량의 실제 마지막 도착km 조회
    // 차량별로 각각 최대 arrival_km 1건 조회 (2026-11 수정)
    //  - 이전: 전체 차량을 한 번에 arrival_km 내림차순 + limit → km가 큰 차량(예: 9만km) 기록이
    //    상위를 모두 차지해 신규 차량(예: 173km)은 결과에 포함되지 않아 자동입력 누락
    Promise.all(assignedIds.map(vid =>
      adminClient
        .from("trip_logs").select("vehicle_id, arrival_km")
        .eq("vehicle_id", vid)
        .not("arrival_km", "is", null)
        .order("arrival_km", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(r => r.data)
    )),
    supabase
      .from("trip_logs").select("departure_location")
      .eq("driver_id", driver.id)
      .not("departure_location", "eq", "")
      .order("departure_time", { ascending: false })
      .limit(20),
  ]);

  const lastKmMap: Record<string, number> = {};
  lastTrips.forEach(t => {
    if (t && t.vehicle_id && t.arrival_km !== null && !(t.vehicle_id in lastKmMap))
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
      <TripStartForm vehicles={vehicles} driver={driver} lastKmMap={lastKmMap} quickLocations={quickLocations} preferredVehicleId={preferredVehicleId} />
    </div>
  );
}
