import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Fragment } from "react";
import dynamic from "next/dynamic";
import TripActionButtons from "../my-trips/_components/TripActionButtons";
import BulkSubmitSection from "../my-trips/_components/BulkSubmitSection";

// xlsx 라이브러리를 포함하는 ExcelUploadSection — 모바일 번들에서 제외
const ExcelUploadSection = dynamic(
  () => import("./_components/ExcelUploadSection"),
  { ssr: false, loading: () => null }
);

export const metadata = { title: "차량 기록 — 차량 운행일지" };

// 서비스 롤 클라이언트 싱글턴 (요청마다 재생성 방지)
const adminClient = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Props = { searchParams: { vehicle_id?: string; month?: string } };

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  draft:     { text: "작성중",   cls: "bg-gray-100 text-gray-600" },
  submitted: { text: "승인대기", cls: "bg-amber-100 text-amber-700" },
  approved:  { text: "승인완료", cls: "bg-emerald-100 text-emerald-700" },
  rejected:  { text: "반려됨",   cls: "bg-red-100 text-red-600" },
};

const TYPE_BADGE: Record<string, string> = {
  "업무":     "bg-blue-100 text-blue-700",
  "출퇴근":   "bg-emerald-100 text-emerald-700",
  "개인사용": "bg-orange-100 text-orange-700",
};

type GapInfo = { fromKm: number; toKm: number; gapKm: number };

export default async function VehicleTripsPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ── 날짜 계산 (DB 쿼리 전에 미리) ──
  const now           = new Date();
  const selectedMonth = searchParams.month
    ? new Date(searchParams.month + "-01")
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStart    = selectedMonth.toISOString();
  const monthEnd      = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1).toISOString();
  const prevMonth     = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);
  const nextMonth     = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
  const prevParam     = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
  const nextParam     = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel    = selectedMonth.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
  const candidateVehicleId = searchParams.vehicle_id ?? "";

  // ── Round 1: driver 조회 ──
  const { data: driver } = await supabase
    .from("drivers").select("id, name").eq("user_id", user.id).maybeSingle();

  // ── Round 2: 배정 차량 목록 + trips 병렬 조회 ──
  // vehicle_drivers + vehicles 를 join 한 번으로 처리 (2 round trip → 1)
  // candidateVehicleId 가 URL에 있으면 trips도 함께 선조회
  const [assignmentRes, earlyTripsRes] = driver
    ? await Promise.all([
        supabase
          .from("vehicle_drivers")
          .select("vehicle_id, vehicles(id, plate_number, model, purpose, is_active)")
          .eq("driver_id", driver.id),
        candidateVehicleId
          ? adminClient
              .from("trip_logs")
              .select(`
                id, departure_time, arrival_time, departure_location, arrival_location,
                departure_km, arrival_km, distance_km, toll_fee, status, purpose, trip_type,
                driver_id, drivers(id, name)
              `)
              .eq("vehicle_id", candidateVehicleId)
              .gte("departure_time", monthStart)
              .lt("departure_time", monthEnd)
              .order("departure_time", { ascending: false })
          : Promise.resolve({ data: null, error: null }),
      ])
    : [{ data: [] as any[], error: null }, { data: null, error: null }];

  // 배정 차량 목록 추출
  const assignments = assignmentRes.data ?? [];
  const assignedIds = assignments.map((r: any) => r.vehicle_id as string);
  const vehicles = assignments
    .map((r: any) => r.vehicles)
    .filter((v: any): v is { id: string; plate_number: string; model: string; purpose: string } =>
      v != null && v.is_active === true
    )
    .sort((a: any, b: any) => a.plate_number.localeCompare(b.plate_number));

  if (!vehicles.length) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-2xl">🚗</p>
        <p className="font-semibold">배정된 차량이 없습니다</p>
        <p className="text-sm text-muted-foreground">관리자에게 차량 배정을 요청하세요.</p>
      </div>
    );
  }

  // 보안 검증: URL vehicle_id 가 배정 목록에 없으면 첫 번째 차량으로
  const selectedVehicleId = assignedIds.includes(candidateVehicleId)
    ? candidateVehicleId
    : vehicles[0]?.id ?? "";
  const selectedVehicle = vehicles.find((v: any) => v.id === selectedVehicleId);

  // trips: URL vehicle_id 와 실제 선택 차량이 같으면 earlyTrips 재사용, 아니면 별도 조회
  const trips = selectedVehicleId
    ? (selectedVehicleId === candidateVehicleId && earlyTripsRes.data !== null
        ? earlyTripsRes.data
        : (await adminClient
            .from("trip_logs")
            .select(`
              id, departure_time, arrival_time, departure_location, arrival_location,
              departure_km, arrival_km, distance_km, toll_fee, status, purpose, trip_type,
              driver_id, drivers(id, name)
            `)
            .eq("vehicle_id", selectedVehicleId)
            .gte("departure_time", monthStart)
            .lt("departure_time", monthEnd)
            .order("departure_time", { ascending: false })
          ).data)
    : null;

  // ── 미입력 구간 탐지 (km 기반 정렬) ──
  const gapAfterTrip = new Map<string, GapInfo>();
  if (trips) {
    const kmSorted = [...trips]
      .filter(t => t.arrival_km != null)
      .sort((a, b) => (a.departure_km ?? 0) - (b.departure_km ?? 0));

    for (let i = 0; i < kmSorted.length - 1; i++) {
      const lower  = kmSorted[i];
      const higher = kmSorted[i + 1];
      if (
        lower.arrival_km   != null &&
        higher.departure_km != null &&
        lower.arrival_km   !== higher.departure_km &&
        higher.departure_km > lower.arrival_km
      ) {
        gapAfterTrip.set(higher.id, {
          fromKm: lower.arrival_km,
          toKm:   higher.departure_km,
          gapKm:  higher.departure_km - lower.arrival_km,
        });
      }
    }
  }

  const gapCount = gapAfterTrip.size;

  // 내 미제출 draft 기록 (BulkSubmitSection)
  const submitableDrafts = (trips ?? [])
    .filter(t => t.status === "draft" && t.arrival_time !== null && t.driver_id === driver?.id)
    .map(t => ({
      id:                 t.id,
      departure_time:     t.departure_time,
      departure_location: t.departure_location,
      arrival_location:   t.arrival_location,
      distance_km:        t.distance_km,
      toll_fee:           t.toll_fee,
      trip_type:          t.trip_type,
    }));

  return (
    <div className="pb-6">
      {/* 월 선택 */}
      <div className="flex items-center justify-between px-4 py-3 bg-background border-b border-border">
        <Link href={`/vehicle-trips?vehicle_id=${selectedVehicleId}&month=${prevParam}`} className="p-2 rounded-lg hover:bg-muted">&lt;</Link>
        <span className="font-semibold text-sm">{monthLabel}</span>
        <Link href={`/vehicle-trips?vehicle_id=${selectedVehicleId}&month=${nextParam}`}
          className="p-2 rounded-lg hover:bg-muted">&gt;</Link>
      </div>

      {/* 차량 선택 탭 */}
      <div className="flex gap-2 px-4 pt-3 pb-2 overflow-x-auto">
        {vehicles.map((v: any) => (
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

      {/* 공유 차량 미입력 구간 알림 */}
      {gapCount > 0 && (
        <div className="mx-4 mb-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 flex items-center gap-2">
          <span className="text-sm shrink-0">⚠️</span>
          <p className="text-xs text-amber-700">미입력 구간 {gapCount}건이 있습니다. 아래에서 확인하세요.</p>
        </div>
      )}

      {/* Excel 업로드 (PC 전용 — dynamic import로 모바일 번들 제외) */}
      {selectedVehicle && (
        <ExcelUploadSection
          vehicleId={selectedVehicleId}
          vehiclePlate={(selectedVehicle as any).plate_number}
        />
      )}

      {/* 내 미제출 기록 일괄 제출 */}
      <BulkSubmitSection drafts={submitableDrafts} />

      {/* 운행 기록 목록 */}
      {!trips?.length ? (
        <div className="px-4 py-12 text-center text-muted-foreground text-sm">
          이번 달 해당 차량의 운행 기록이 없습니다
        </div>
      ) : (
        <div className="px-4 mt-3 space-y-2">
          {trips.map(trip => {
            const dep        = new Date(trip.departure_time);
            const isOngoing  = !trip.arrival_time;
            const tripType   = trip.trip_type ?? "업무";
            const badgeCls   = TYPE_BADGE[tripType] ?? TYPE_BADGE["업무"];
            const statusInfo = STATUS_LABEL[trip.status] ?? STATUS_LABEL.draft;
            const isMyTrip   = trip.driver_id === driver?.id;
            const driverName: string = (trip.drivers as any)?.name ?? "알 수 없음";
            const gap = gapAfterTrip.get(trip.id);

            return (
              <Fragment key={trip.id}>
                {/* ── 운행 카드 ── */}
                <div className={`rounded-2xl border p-4 space-y-2
                  ${isMyTrip
                    ? "bg-background border-border"
                    : "bg-muted/20 border-border/50"}`}>

                  {/* 운전자 + 유형 + 날짜 + 상태 */}
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5
                        ${isMyTrip
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"}`}>
                        {isMyTrip ? "나" : driverName}
                      </span>
                      <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${badgeCls}`}>
                        {tripType}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {dep.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric", weekday: "short" })}
                        {" "}
                        {dep.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 shrink-0
                      ${isOngoing ? "bg-blue-100 text-blue-700" : statusInfo.cls}`}>
                      {isOngoing ? "운행중" : statusInfo.text}
                    </span>
                  </div>

                  {/* 출발지 → 도착지 */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium truncate flex-1">{trip.departure_location}</span>
                    <span className="text-muted-foreground text-xs shrink-0">→</span>
                    <span className="font-medium truncate flex-1 text-right">{trip.arrival_location ?? "—"}</span>
                  </div>

                  {/* km 정보 */}
                  {!isOngoing && (
                    <div className="grid grid-cols-4 gap-1 text-xs bg-muted rounded-lg px-3 py-2">
                      <div className="text-center">
                        <p className="text-muted-foreground">출발km</p>
                        <p className="font-medium">{(trip.departure_km ?? 0).toLocaleString("ko-KR")}</p>
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
                        <p className="font-medium">{(trip.toll_fee ?? 0) > 0 ? (trip.toll_fee ?? 0).toLocaleString("ko-KR") : "—"}</p>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">{trip.purpose}</p>

                  {/* 운행중 → 도착 입력 (내 기록만) */}
                  {isOngoing && isMyTrip && (
                    <a href={`/trip/${trip.id}/end`}
                      className="block text-center text-xs font-semibold text-primary border border-primary/30 rounded-lg py-2 bg-primary/5">
                      🚩 도착 정보 입력하기
                    </a>
                  )}

                  {/* 내 기록 수정/삭제 (draft만 — 제출 후에는 수정 불가) */}
                  {trip.status === "draft" && !isOngoing && isMyTrip && (
                    <TripActionButtons tripId={trip.id} />
                  )}

                  {/* 타인 기록 잠금 표시 */}
                  {!isMyTrip && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 pt-0.5">
                      🔒 다른 운전자의 기록 — 조회만 가능
                    </p>
                  )}
                </div>

                {/* ── 미입력 구간 갭 카드 ── */}
                {gap && (
                  <div className="rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-amber-800">⚠️ 미입력 구간</p>
                      <span className="text-xs font-semibold bg-amber-200 text-amber-800 rounded-full px-2.5 py-0.5">
                        {gap.gapKm.toLocaleString("ko-KR")} km
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-amber-700">
                      <span className="bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 font-semibold">
                        {gap.fromKm.toLocaleString("ko-KR")} km
                      </span>
                      <span className="flex-1 text-center text-amber-400 text-xs">· · · 기록 없음 · · ·</span>
                      <span className="bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 font-semibold">
                        {gap.toKm.toLocaleString("ko-KR")} km
                      </span>
                    </div>
                    <a
                      href={`/trip/retroactive?vehicle_id=${selectedVehicleId}&from_km=${gap.fromKm}&to_km=${gap.toKm}`}
                      className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold">
                      ✏️ 이 구간 내가 운전했어요 → 입력하기
                    </a>
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      )}

      {/* 운행시작 버튼 */}
      <div className="px-4 mt-4">
        <a href="/trip/start"
          className="flex items-center justify-center gap-2 w-full rounded-2xl bg-primary text-primary-foreground py-4 text-base font-semibold shadow-md">
          🚗 운행 시작
        </a>
      </div>
    </div>
  );
}
