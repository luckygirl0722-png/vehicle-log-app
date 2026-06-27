import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import KpiCards from "./_components/KpiCards";
import MonthlyChart from "./_components/MonthlyChart";
import VehicleChart from "./_components/VehicleChart";
import RecentTrips from "./_components/RecentTrips";
import RealtimeSubscriber from "./_components/RealtimeSubscriber";
import VehicleMonthlyStats from "./_components/VehicleMonthlyStats";
import DriverMonthlyStats from "./_components/DriverMonthlyStats";

export const metadata = { title: "대시보드 - 차량 운행일지" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roleRow } = await supabase
    .from("user_roles").select("role").eq("user_id", user.id).single();
  if (roleRow?.role !== "admin") redirect("/");

  const now = new Date();
  const curMonthStart  = new Date(now.getFullYear(), now.getMonth(),     1).toISOString();
  const curMonthEnd    = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const sixMonthsAgo   = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

  const [
    { data: curRows },
    { data: prevRows },
    { data: monthlyRows },
    { data: vehicleRows },
    { data: recentTrips },
    { data: vehicles },
    { data: vehicleTripRows },
    { data: driverTripRows },
  ] = await Promise.all([
    supabase.from("trip_logs").select("distance_km, toll_fee, status, trip_type")
      .gte("departure_time", curMonthStart).lt("departure_time", curMonthEnd),
    supabase.from("trip_logs").select("distance_km, toll_fee")
      .gte("departure_time", prevMonthStart).lt("departure_time", curMonthStart),
    supabase.from("trip_logs").select("departure_time, distance_km, toll_fee")
      .gte("departure_time", sixMonthsAgo).not("arrival_time", "is", null),
    supabase.from("trip_logs").select("vehicle_id, distance_km, vehicles(plate_number)")
      .gte("departure_time", curMonthStart).lt("departure_time", curMonthEnd)
      .not("distance_km", "is", null),
    supabase.from("trip_logs")
      .select("id, status, departure_time, departure_location, arrival_location, distance_km, vehicles(plate_number), drivers(name)")
      .order("departure_time", { ascending: false }).limit(5),
    supabase.from("vehicles").select("id, plate_number, model").eq("is_active", true).order("plate_number"),
    // 차량별 업무/출퇴근 집계용
    supabase.from("trip_logs")
      .select("vehicle_id, distance_km, toll_fee, trip_type")
      .gte("departure_time", curMonthStart).lt("departure_time", curMonthEnd)
      .not("arrival_time", "is", null),
    // 운전자별 집계용
    supabase.from("trip_logs")
      .select("driver_id, vehicle_id, distance_km, toll_fee, trip_type, drivers(name), vehicles(plate_number, model)")
      .gte("departure_time", curMonthStart).lt("departure_time", curMonthEnd)
      .not("arrival_time", "is", null),
  ]);

  // KPI
  const bizRows = curRows?.filter(t => (t.trip_type ?? "업무") === "업무") ?? [];
  const currentMonth = {
    tripCount:      curRows?.length ?? 0,
    totalDistance:  bizRows.reduce((s, t) => s + (t.distance_km ?? 0), 0),
    totalToll:      bizRows.reduce((s, t) => s + (t.toll_fee ?? 0), 0),
    submittedCount: curRows?.filter(t => t.status === "submitted").length ?? 0,
  };
  const prevMonth = {
    tripCount:     prevRows?.length ?? 0,
    totalDistance: prevRows?.reduce((s, t) => s + (t.distance_km ?? 0), 0) ?? 0,
    totalToll:     prevRows?.reduce((s, t) => s + (t.toll_fee ?? 0), 0) ?? 0,
  };

  // 월별 차트
  const monthlyMap: Record<string, { distance: number; toll: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthlyMap[`${d.getMonth()+1}월`] = { distance: 0, toll: 0 };
  }
  monthlyRows?.forEach(row => {
    const d = new Date(row.departure_time);
    const k = `${d.getMonth()+1}월`;
    if (monthlyMap[k]) {
      monthlyMap[k].distance += row.distance_km ?? 0;
      monthlyMap[k].toll     += row.toll_fee ?? 0;
    }
  });
  const monthlyChartData = Object.entries(monthlyMap).map(([month, v]) => ({ month, ...v }));

  // 차량별 파이차트
  const vehicleMap: Record<string, { plate_number: string; distance: number; tripCount: number }> = {};
  vehicleRows?.forEach(row => {
    const pid   = row.vehicle_id;
    const plate = (row.vehicles as any)?.plate_number ?? "unknown";
    if (!vehicleMap[pid]) vehicleMap[pid] = { plate_number: plate, distance: 0, tripCount: 0 };
    vehicleMap[pid].distance  += row.distance_km ?? 0;
    vehicleMap[pid].tripCount += 1;
  });
  const vehicleChartData = Object.values(vehicleMap)
    .sort((a, b) => b.distance - a.distance).slice(0, 6);

  // ★ 차량별 업무/출퇴근 집계
  type VRow = { bizKm: number; bizToll: number; comKm: number; comToll: number; perKm: number; perToll: number; totalKm: number; plate_number: string; model: string; };
  const vStatsMap: Record<string, VRow> = {};
  vehicles?.forEach(v => {
    vStatsMap[v.id] = { plate_number: v.plate_number, model: v.model, bizKm: 0, bizToll: 0, comKm: 0, comToll: 0, perKm: 0, perToll: 0, totalKm: 0 };
  });
  vehicleTripRows?.forEach(row => {
    if (!row.vehicle_id || !vStatsMap[row.vehicle_id]) return;
    const s   = vStatsMap[row.vehicle_id];
    const km  = row.distance_km ?? 0;
    const tol = row.toll_fee ?? 0;
    s.totalKm += km;
    if (row.trip_type === "출퇴근")   { s.comKm += km; s.comToll += tol; }
    else if (row.trip_type === "개인사용") { s.perKm += km; s.perToll += tol; }
    else                               { s.bizKm += km; s.bizToll += tol; }
  });
  const vehicleStatsRows = Object.values(vStatsMap).filter(r => r.totalKm > 0);


  // ★ 운전자별 집계 (차량별 세부 포함)
  interface DVRow { bizKm:number; bizToll:number; comKm:number; comToll:number; perKm:number; perToll:number; totalKm:number; tripCount:number; plate_number:string; model:string; vehicle_id:string; }
  interface DSRow { driver_id:string; driver_name:string; bizKm:number; bizToll:number; comKm:number; comToll:number; perKm:number; perToll:number; totalKm:number; tripCount:number; vehicles:DVRow[]; }
  const driverMap: Record<string, DSRow> = {};
  driverTripRows?.forEach((row: any) => {
    const did   = row.driver_id ?? "unknown";
    const dname = row.drivers?.name ?? "미상";
    const vid   = row.vehicle_id ?? "unknown";
    const plate = row.vehicles?.plate_number ?? "—";
    const model = row.vehicles?.model ?? "—";
    const km    = row.distance_km ?? 0;
    const tol   = row.toll_fee ?? 0;
    const type  = row.trip_type ?? "업무";
    if (!driverMap[did]) driverMap[did] = { driver_id:did, driver_name:dname, bizKm:0, bizToll:0, comKm:0, comToll:0, perKm:0, perToll:0, totalKm:0, tripCount:0, vehicles:[] };
    const ds = driverMap[did];
    ds.totalKm += km; ds.tripCount += 1;
    if (type === "출퇴근")   { ds.comKm += km; ds.comToll += tol; }
    else if (type === "개인사용") { ds.perKm += km; ds.perToll += tol; }
    else                     { ds.bizKm += km; ds.bizToll += tol; }
    let vs = ds.vehicles.find(v => v.vehicle_id === vid);
    if (!vs) { vs = { vehicle_id:vid, plate_number:plate, model, bizKm:0, bizToll:0, comKm:0, comToll:0, perKm:0, perToll:0, totalKm:0, tripCount:0 }; ds.vehicles.push(vs); }
    vs.totalKm += km; vs.tripCount += 1;
    if (type === "출퇴근")   { vs.comKm += km; vs.comToll += tol; }
    else if (type === "개인사용") { vs.perKm += km; vs.perToll += tol; }
    else                     { vs.bizKm += km; vs.bizToll += tol; }
  });
  const driverStatsRows = Object.values(driverMap).sort((a, b) => b.totalKm - a.totalKm);

  const monthLabel = `${now.getFullYear()}년 ${now.getMonth()+1}월`;

  return (
    <div className="p-6 space-y-6">
      <RealtimeSubscriber />

      <div>
        <h1 className="text-2xl font-bold">대시보드</h1>
        <p className="text-sm text-muted-foreground mt-1">{monthLabel} 차량 운행 현황</p>
      </div>

      <KpiCards currentMonth={currentMonth} prevMonth={prevMonth} />

      {/* 차트 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-xl border bg-background p-5">
          <h2 className="text-sm font-semibold mb-4">월별 운행 추이 (최근 6개월)</h2>
          <Suspense fallback={<div className="h-60 animate-pulse bg-muted rounded" />}>
            <MonthlyChart data={monthlyChartData} />
          </Suspense>
        </div>
        <div className="rounded-xl border bg-background p-5">
          <h2 className="text-sm font-semibold mb-4">이번 달 차량별 운행거리</h2>
          <Suspense fallback={<div className="h-60 animate-pulse bg-muted rounded" />}>
            <VehicleChart data={vehicleChartData} />
          </Suspense>
        </div>
      </div>

      {/* ★ 차량별 월별 집계 (업무/출퇴근 분리) */}
      <div className="rounded-xl border bg-background p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">{monthLabel} 차량별 운행 집계</h2>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary inline-block" />업무</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />출퇴근</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500 inline-block" />개인사용</span>
          </div>
        </div>
        <VehicleMonthlyStats rows={vehicleStatsRows} monthLabel={monthLabel} year={now.getFullYear()} month={now.getMonth()+1} />
      </div>


      {/* ★ 운전자별 월별 집계 */}
      <div className="rounded-xl border bg-background p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">{monthLabel} 운전자별 운행 집계</h2>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary inline-block" />업무</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />출퇴근</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500 inline-block" />개인사용</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-3">▶ 복수 차량 사용 운전자는 클릭하면 차량별 세부 내역을 볼 수 있습니다.</p>
        <DriverMonthlyStats rows={driverStatsRows} year={now.getFullYear()} month={now.getMonth()+1} />
      </div>

      {/* 최근 운행 */}
      <div className="rounded-xl border bg-background p-5">
        <h2 className="text-sm font-semibold mb-3">최근 운행 기록</h2>
        <RecentTrips trips={(recentTrips ?? []) as any} />
      </div>
    </div>
  );
}
