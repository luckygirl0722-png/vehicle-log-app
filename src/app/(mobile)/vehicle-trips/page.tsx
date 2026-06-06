import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "차량별 기록 — 차량 운행일지" };

type Props = { searchParams: { vehicle_id?: string; month?: string } };

export default async function VehicleTripsPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 내가 속한 부서의 모든 활성 차량 조회
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, plate_number, model, purpose")
    .eq("is_active", true)
    .order("plate_number");

  const selectedVehicleId = searchParams.vehicle_id ?? vehicles?.[0]?.id ?? "";
  const selectedVehicle = vehicles?.find(v => v.id === selectedVehicleId);

  const now = new Date();
  const selectedMonth = searchParams.month
    ? new Date(searchParams.month + "-01")
    : new Date(now.getFullYear(), now.getMonth(), 1);

  const monthStart = selectedMonth.toISOString();
  const monthEnd   = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1).toISOString();

  const prevMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);
  const nextMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
  const prevParam = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
  const nextParam = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
  const isCurrentMonth = selectedMonth.getMonth() === now.getMonth() && selectedMonth.getFullYear() === now.getFullYear();
  const monthLabel = selectedMonth.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });

  // 선택된 차량의 전체 운행기록 (모든 운전자 포함 — RLS에서 admin 권한이 있거나 운전자 본인만)
  const { data: trips } = selectedVehicleId
    ? await supabase
        .from("trip_logs")
        .select(`id, departure_time, departure_location, arrival_location,
                 departure_km, arrival_km, distance_km, toll_fee, status, purpose,
                 drivers(name)`)
        .eq("vehicle_id", selectedVehicleId)
        .gte("departure_time", monthStart)
        .lt("departure_time", monthEnd)
        .not("arrival_time", "is", null)
        .order("departure_time", { ascending: true })
    : { data: null };

  const totalDistance = trips?.reduce((s, t) => s + (t.distance_km ?? 0), 0) ?? 0;
  const totalToll     = trips?.reduce((s, t) => s + (t.toll_fee ?? 0), 0) ?? 0;

  return (
    <div className="pb-6">
      {/* 월 선택 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-background border-b border-border">
        <Link href={`/vehicle-trips?vehicle_id=${selectedVehicleId}&month=${prevParam}`} className="p-2 rounded-lg hover:bg-muted">
          &lt;
        </Link>
        <span className="font-semibold text-sm">{monthLabel}</span>
        <Link href={`/vehicle-trips?vehicle_id=${selectedVehicleId}&month=${nextParam}`}
          className={isCurrentMonth ? "opacity-30 pointer-events-none p-2" : "p-2 rounded-lg hover:bg-muted"}>
          &gt;
        </Link>
      </div>

      {/* 차량 선택 탭 */}
      <div className="flex gap-2 px-4 pt-3 pb-2 overflow-x-auto">
        {(vehicles ?? []).map(v => (
          <Link key={v.id}
            href={`/vehicle-trips?vehicle_id=${v.id}${searchParams.month ? `&month=${searchParams.month}` : ""}`}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium border transition-colors
              ${selectedVehicleId === v.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-foreground"}`}>
            {v.plate_number}
          </Link>
        ))}
      </div>

      {/* 선택 차량 정보 */}
      {selectedVehicle && (
        <div className="mx-4 mb-3 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
          <p className="text-sm font-semibold text-primary">{selectedVehicle.plate_number}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{selectedVehicle.model} · {selectedVehicle.purpose}</p>
        </div>
      )}

      {/* 월 집계 */}
      <div className="grid grid-cols-3 gap-2 px-4 mb-3">
        {[
          { label: "운행 건수", value: `${trips?.length ?? 0}`, unit: "건" },
          { label: "총 운행거리", value: totalDistance.toLocaleString("ko-KR"), unit: "km" },
          { label: "총 통행료", value: totalToll.toLocaleString("ko-KR"), unit: "원" },
        ].map(({ label, value, unit }) => (
          <div key={label} className="rounded-xl bg-muted p-3 text-center">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-base font-bold mt-0.5">{value}<span className="text-xs font-normal ml-0.5">{unit}</span></p>
          </div>
        ))}
      </div>

      {/* 운행 기록 목록 */}
      {!trips?.length ? (
        <div className="px-4 py-12 text-center text-muted-foreground text-sm">
          이번 달 운행 기록이 없습니다
        </div>
      ) : (
        <div className="px-4 space-y-2">
          {trips.map((trip, idx) => {
            const dep = new Date(trip.departure_time);
            return (
              <div key={trip.id} className="rounded-2xl bg-background border border-border p-4 space-y-2">
                {/* 날짜 + 운전자 */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {dep.toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" })}
                    {" "}
                    {dep.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-xs font-medium text-primary">
                    {(trip.drivers as any)?.name ?? "—"}
                  </span>
                </div>

                {/* 출발지 → 도착지 */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium truncate flex-1">{trip.departure_location}</span>
                  <span className="text-muted-foreground text-xs">→</span>
                  <span className="font-medium truncate flex-1 text-right">{trip.arrival_location ?? "—"}</span>
                </div>

                {/* km 정보 */}
                <div className="grid grid-cols-4 gap-1 text-xs bg-muted rounded-lg px-3 py-2">
                  <div className="text-center">
                    <p className="text-muted-foreground">출발km</p>
                    <p className="font-medium">{trip.departure_km.toLocaleString("ko-KR")}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">도착km</p>
                    <p className="font-medium">{(trip.arrival_km ?? 0).toLocaleString("ko-KR")}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">운행km</p>
                    <p className="font-bold text-primary">{(trip.distance_km ?? 0).toLocaleString("ko-KR")}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">통행료</p>
                    <p className="font-medium">{trip.toll_fee > 0 ? trip.toll_fee.toLocaleString("ko-KR") : "—"}</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">{trip.purpose}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
