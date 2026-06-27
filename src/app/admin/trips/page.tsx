import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import TripFilters from "./_components/TripFilters";
import TripsClient from "./_components/TripsClient";

export const metadata = { title: "운행 현황 — 차량 운행일지" };

type Props = {
  searchParams: {
    month?: string; vehicle_id?: string; driver_id?: string;
    status?: string; page?: string;
  };
};

export default async function AdminTripsPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roleRow } = await supabase
    .from("user_roles").select("role").eq("user_id", user.id).single();
  if (roleRow?.role !== "admin") redirect("/");

  // 필터 파라미터 파싱
  const page      = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const limit     = 20;
  const offset    = (page - 1) * limit;

  // 기본 운행 기록 쿼리
  let query = supabase
    .from("trip_logs")
    .select(
      `id, status, trip_type, departure_time, departure_location, arrival_location, arrival_time,
       departure_km, arrival_km, distance_km, purpose, toll_fee, note,
       vehicles(plate_number, model), drivers(name, employee_no)`,
      { count: "exact" }
    )
    .order("departure_time", { ascending: false })
    .range(offset, offset + limit - 1);

  // 월 필터
  if (searchParams.month) {
    const [y, m]  = searchParams.month.split("-").map(Number);
    const from    = new Date(y, m - 1, 1).toISOString();
    const to      = new Date(y, m, 1).toISOString();
    query = query.gte("departure_time", from).lt("departure_time", to);
  }
  if (searchParams.vehicle_id) query = query.eq("vehicle_id", searchParams.vehicle_id);
  if (searchParams.driver_id)  query = query.eq("driver_id", searchParams.driver_id);
  if (searchParams.status)     query = query.eq("status", searchParams.status);

  const { data: trips, count } = await query;

  // 요약 집계 (필터 동일 조건)
  let summaryQuery = supabase
    .from("trip_logs")
    .select("distance_km, toll_fee, status");

  if (searchParams.month) {
    const [y, m] = searchParams.month.split("-").map(Number);
    summaryQuery = summaryQuery
      .gte("departure_time", new Date(y, m - 1, 1).toISOString())
      .lt("departure_time",  new Date(y, m, 1).toISOString());
  }
  if (searchParams.vehicle_id) summaryQuery = summaryQuery.eq("vehicle_id", searchParams.vehicle_id);
  if (searchParams.driver_id)  summaryQuery = summaryQuery.eq("driver_id", searchParams.driver_id);
  if (searchParams.status)     summaryQuery = summaryQuery.eq("status", searchParams.status);

  const { data: summaryRows } = await summaryQuery;
  const summary = {
    totalDistance:  summaryRows?.reduce((s, t) => s + (t.distance_km ?? 0), 0) ?? 0,
    totalToll:      summaryRows?.reduce((s, t) => s + (t.toll_fee ?? 0), 0) ?? 0,
    submittedCount: summaryRows?.filter(t => t.status === "submitted").length ?? 0,
  };

  // 필터 옵션용 차량·운전자 목록
  const [{ data: vehicles }, { data: drivers }] = await Promise.all([
    supabase.from("vehicles").select("id, plate_number").eq("is_active", true).order("plate_number"),
    supabase.from("drivers").select("id, name, employee_no").eq("is_active", true).order("name"),
  ]);

  const total      = count ?? 0;
  const totalPages = Math.ceil(total / limit);
  const currentParams = new URLSearchParams({
    ...(searchParams.month      && { month:      searchParams.month }),
    ...(searchParams.vehicle_id && { vehicle_id: searchParams.vehicle_id }),
    ...(searchParams.driver_id  && { driver_id:  searchParams.driver_id }),
    ...(searchParams.status     && { status:     searchParams.status }),
  }).toString();

  return (
    <div className="p-6 space-y-4">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">운행 현황</h1>
        <p className="text-sm text-muted-foreground mt-1">
          전체 차량 운행 기록 조회 및 승인 관리
        </p>
      </div>

      {/* 필터 */}
      <Suspense>
        <TripFilters
          vehicles={(vehicles ?? []).map(v => ({ id: v.id, label: v.plate_number }))}
          drivers={(drivers ?? []).map(d => ({ id: d.id, label: `${d.name} (${d.employee_no})` }))}
        />
      </Suspense>

      {/* 테이블 + 페이지네이션 */}
      <TripsClient
        trips={(trips ?? []) as any}
        pagination={{ page, limit, total, totalPages }}
        summary={summary}
        currentParams={currentParams}
      />
    </div>
  );
}
