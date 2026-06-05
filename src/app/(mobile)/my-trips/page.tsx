import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "내 기록 — 차량 운행일지" };

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  draft:     { text: "작성중",   className: "bg-gray-100 text-gray-600" },
  submitted: { text: "승인대기", className: "bg-amber-100 text-amber-700" },
  approved:  { text: "승인완료", className: "bg-emerald-100 text-emerald-700" },
  rejected:  { text: "반려됨",   className: "bg-red-100 text-red-600" },
};

type Props = { searchParams: { status?: string; month?: string } };

export default async function MyTripsPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: driver } = await supabase
    .from("drivers")
    .select("id, name")
    .eq("user_id", user.id)
    .single();

  if (!driver) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        운전자 등록이 필요합니다.
      </div>
    );
  }

  const now = new Date();
  const selectedMonth = searchParams.month
    ? new Date(searchParams.month + "-01")
    : new Date(now.getFullYear(), now.getMonth(), 1);

  const monthStart = selectedMonth.toISOString();
  const monthEnd   = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1).toISOString();

  let query = supabase
    .from("trip_logs")
    .select("id, departure_time, departure_location, arrival_location, arrival_time, distance_km, toll_fee, status, purpose")
    .eq("driver_id", driver.id)
    .gte("departure_time", monthStart)
    .lt("departure_time", monthEnd)
    .order("departure_time", { ascending: false });

  if (searchParams.status) query = query.eq("status", searchParams.status);

  const { data: trips } = await query;

  const totalDistance = trips?.reduce((s, t) => s + (t.distance_km ?? 0), 0) ?? 0;
  const totalToll     = trips?.reduce((s, t) => s + (t.toll_fee ?? 0), 0) ?? 0;

  const monthLabel = selectedMonth.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });

  // 이전/다음 달 계산
  const prevMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);
  const nextMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
  const prevParam = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
  const nextParam = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
  const isCurrentMonth = selectedMonth.getMonth() === now.getMonth() && selectedMonth.getFullYear() === now.getFullYear();

  return (
    <div className="pb-6">
      {/* 월 선택 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-background border-b border-border">
        <Link href={`/my-trips?month=${prevParam}`} className="p-2 rounded-lg hover:bg-muted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <span className="font-semibold text-sm">{monthLabel}</span>
        <Link href={`/my-trips?month=${nextParam}`}
          className={`p-2 rounded-lg ${isCurrentMonth ? "opacity-30 pointer-events-none" : "hover:bg-muted"}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>
      </div>

      {/* 월 집계 */}
      <div className="grid grid-cols-2 gap-3 p-4">
        <div className="rounded-xl bg-muted p-3 text-center">
          <p className="text-xs text-muted-foreground">총 운행거리</p>
          <p className="text-xl font-bold mt-0.5">{totalDistance.toLocaleString("ko-KR")}
            <span className="text-xs font-normal ml-1">km</span>
          </p>
        </div>
        <div className="rounded-xl bg-muted p-3 text-center">
          <p className="text-xs text-muted-foreground">총 통행료</p>
          <p className="text-xl font-bold mt-0.5">{totalToll.toLocaleString("ko-KR")}
            <span className="text-xs font-normal ml-1">원</span>
          </p>
        </div>
      </div>

      {/* 상태 필터 탭 */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
        {[
          { key: "",          label: "전체" },
          { key: "draft",     label: "작성중" },
          { key: "submitted", label: "승인대기" },
          { key: "approved",  label: "승인완료" },
        ].map(({ key, label }) => (
          <Link key={key}
            href={`/my-trips${key ? `?status=${key}` : ""}${searchParams.month ? `${key ? "&" : "?"}month=${searchParams.month}` : ""}`}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors
              ${searchParams.status === key || (!searchParams.status && !key)
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"}`}>
            {label}
          </Link>
        ))}
      </div>

      {/* 기록 목록 */}
      {!trips?.length ? (
        <div className="px-4 py-12 text-center text-muted-foreground text-sm">
          이번 달 운행 기록이 없습니다
        </div>
      ) : (
        <div className="px-4 space-y-3">
          {trips.map(trip => {
            const dep = new Date(trip.departure_time);
            const statusInfo = STATUS_LABEL[trip.status] ?? STATUS_LABEL.draft;
            const isOngoing = !trip.arrival_time;

            return (
              <Link key={trip.id}
                href={isOngoing ? `/trip/${trip.id}/end` : `/trip/${trip.id}/complete`}
                className="block rounded-2xl bg-background border border-border p-4 space-y-3 active:bg-muted/50 transition-colors">
                {/* 상단: 날짜 + 상태 배지 */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {dep.toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" })}
                    {" · "}
                    {dep.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${statusInfo.className}`}>
                    {isOngoing ? "🚗 운행중" : statusInfo.text}
                  </span>
                </div>

                {/* 출발 → 도착 */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium truncate flex-1">{trip.departure_location}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted-foreground">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                  <span className="font-medium truncate flex-1 text-right">
                    {trip.arrival_location ?? "—"}
                  </span>
                </div>

                {/* 하단: 통계 */}
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>📍 {trip.distance_km !== null ? `${trip.distance_km.toLocaleString("ko-KR")}km` : "진행중"}</span>
                  {trip.toll_fee > 0 && <span>🛣 {trip.toll_fee.toLocaleString("ko-KR")}원</span>}
                  <span className="truncate">{trip.purpose}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
