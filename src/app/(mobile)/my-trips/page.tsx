import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BulkSubmitSection from "./_components/BulkSubmitSection";
import TripActionButtons from "./_components/TripActionButtons";

export const metadata = { title: "내 기록 - 차량 운행일지" };

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  draft:     { text: "작성중",   className: "bg-gray-100 text-gray-600" },
  submitted: { text: "승인대기", className: "bg-amber-100 text-amber-700" },
  approved:  { text: "승인완료", className: "bg-emerald-100 text-emerald-700" },
  rejected:  { text: "반려됨",   className: "bg-red-100 text-red-600" },
};

const TYPE_STYLE: Record<string, { card: string; badge: string; label: string }> = {
  "업무":     { card: "bg-background border-border",       badge: "bg-muted text-muted-foreground",   label: "업무"     },
  "출퇴근":   { card: "bg-emerald-50 border-emerald-200",   badge: "bg-emerald-200 text-emerald-800",  label: "출퇴근"   },
  "개인사용": { card: "bg-orange-50 border-orange-200",     badge: "bg-orange-200 text-orange-800",    label: "개인사용" },
};

type Props = { searchParams: { status?: string; month?: string; type?: string } };

export default async function MyTripsPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: driver } = await supabase
    .from("drivers").select("id, name").eq("user_id", user.id).single();
  if (!driver) {
    return <div className="p-6 text-center text-muted-foreground">운전자 등록이 필요합니다.</div>;
  }

  const now = new Date();
  const selectedMonth = searchParams.month
    ? new Date(searchParams.month + "-01")
    : new Date(now.getFullYear(), now.getMonth(), 1);

  const monthStart = selectedMonth.toISOString();
  const monthEnd   = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1).toISOString();
  const monthLabel = selectedMonth.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
  const prevMonth  = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);
  const nextMonth  = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
  const prevParam  = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
  const nextParam  = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
  const isCurrentMonth = selectedMonth.getMonth() === now.getMonth() && selectedMonth.getFullYear() === now.getFullYear();

  let query = supabase
    .from("trip_logs")
    .select("id, departure_time, departure_location, arrival_location, arrival_time, distance_km, toll_fee, status, purpose, trip_type")
    .eq("driver_id", driver.id)
    .gte("departure_time", monthStart)
    .lt("departure_time", monthEnd)
    .order("departure_time", { ascending: false });

  if (searchParams.status) query = query.eq("status", searchParams.status) as typeof query;
  if (searchParams.type)   query = query.eq("trip_type", searchParams.type) as typeof query;

  const { data: trips } = await query;

  const { data: allTrips } = await supabase
    .from("trip_logs")
    .select("id, distance_km, toll_fee, trip_type, status, arrival_time, departure_time, departure_location, arrival_location")
    .eq("driver_id", driver.id)
    .gte("departure_time", monthStart)
    .lt("departure_time", monthEnd);

  const bizTrips     = allTrips?.filter(t => (t.trip_type ?? "업무") === "업무") ?? [];
  const commuteTrips = allTrips?.filter(t => t.trip_type === "출퇴근") ?? [];
  const personalTrips = allTrips?.filter(t => t.trip_type === "개인사용") ?? [];
  const bizDistance  = bizTrips.reduce((s, t) => s + (t.distance_km ?? 0), 0);
  const bizToll      = bizTrips.reduce((s, t) => s + (t.toll_fee ?? 0), 0);
  const comDistance  = commuteTrips.reduce((s, t) => s + (t.distance_km ?? 0), 0);
  const comToll      = commuteTrips.reduce((s, t) => s + (t.toll_fee ?? 0), 0);
  const perDistance  = personalTrips.reduce((s, t) => s + (t.distance_km ?? 0), 0);
  const perToll      = personalTrips.reduce((s, t) => s + (t.toll_fee ?? 0), 0);

  const submitableDrafts = (allTrips ?? [])
    .filter(t => t.status === "draft" && t.arrival_time !== null)
    .map(t => ({
      id: t.id,
      departure_time: t.departure_time,
      departure_location: t.departure_location,
      arrival_location: t.arrival_location,
      distance_km: t.distance_km,
      toll_fee: t.toll_fee,
      trip_type: t.trip_type,
    }))
    .sort((a, b) => new Date(b.departure_time).getTime() - new Date(a.departure_time).getTime());

  const activeType = searchParams.type ?? "";

  return (
    <div className="pb-6">
      <div className="flex items-center justify-between px-4 py-3 bg-background border-b border-border">
        <Link href={`/my-trips?month=${prevParam}`} className="p-2 rounded-lg hover:bg-muted">&lt;</Link>
        <span className="font-semibold text-sm">{monthLabel}</span>
        <Link href={`/my-trips?month=${nextParam}`}
          className={isCurrentMonth ? "opacity-30 pointer-events-none p-2" : "p-2 rounded-lg hover:bg-muted"}>&gt;</Link>
      </div>

      {/* 업무 집계 */}
      <div className="mx-4 mt-4 rounded-xl border border-border bg-background overflow-hidden">
        <div className="px-4 py-2 bg-muted/50 flex items-center gap-2">
          <span className="text-xs font-semibold">🚗 업무 운행</span>
          <span className="text-xs text-muted-foreground">{bizTrips.length}건</span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="p-3 text-center">
            <p className="text-xs text-muted-foreground">운행거리</p>
            <p className="text-lg font-bold">{bizDistance.toLocaleString("ko-KR")}<span className="text-xs font-normal ml-0.5">km</span></p>
          </div>
          <div className="p-3 text-center">
            <p className="text-xs text-muted-foreground">통행료</p>
            <p className="text-lg font-bold">{bizToll.toLocaleString("ko-KR")}<span className="text-xs font-normal ml-0.5">원</span></p>
          </div>
        </div>
      </div>

      {/* 출퇴근 집계 */}
      <div className="mx-4 mt-2 rounded-xl border border-emerald-200 bg-emerald-50 overflow-hidden">
        <div className="px-4 py-2 bg-emerald-100 flex items-center gap-2">
          <span className="text-xs font-semibold text-emerald-800">🏠 출퇴근</span>
          <span className="text-xs text-emerald-600">{commuteTrips.length}건</span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-emerald-200">
          <div className="p-3 text-center">
            <p className="text-xs text-emerald-600">운행거리</p>
            <p className="text-lg font-bold text-emerald-700">{comDistance.toLocaleString("ko-KR")}<span className="text-xs font-normal ml-0.5">km</span></p>
          </div>
          <div className="p-3 text-center">
            <p className="text-xs text-emerald-600">통행료(개인)</p>
            <p className="text-lg font-bold text-emerald-700">{comToll.toLocaleString("ko-KR")}<span className="text-xs font-normal ml-0.5">원</span></p>
          </div>
        </div>
      </div>

      {/* 개인사용 집계 */}
      <div className="mx-4 mt-2 rounded-xl border border-orange-200 bg-orange-50 overflow-hidden">
        <div className="px-4 py-2 bg-orange-100 flex items-center gap-2">
          <span className="text-xs font-semibold text-orange-800">👤 개인사용</span>
          <span className="text-xs text-orange-600">{personalTrips.length}건</span>
          <span className="ml-auto text-xs text-orange-500">개인 부담</span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-orange-200">
          <div className="p-3 text-center">
            <p className="text-xs text-orange-600">운행거리</p>
            <p className="text-lg font-bold text-orange-700">{perDistance.toLocaleString("ko-KR")}<span className="text-xs font-normal ml-0.5">km</span></p>
          </div>
          <div className="p-3 text-center">
            <p className="text-xs text-orange-600">통행료(개인)</p>
            <p className="text-lg font-bold text-orange-700">{perToll.toLocaleString("ko-KR")}<span className="text-xs font-normal ml-0.5">원</span></p>
          </div>
        </div>
      </div>

      {/* 미제출 기록 선택 제출 */}
      <BulkSubmitSection drafts={submitableDrafts} />

      {/* 필터 탭 */}
      <div className="flex gap-2 px-4 pt-3 pb-2 overflow-x-auto">
        {[
          { key: "",       label: "전체",     activeClass: "bg-primary text-primary-foreground" },
          { key: "업무",   label: "업무",     activeClass: "bg-primary text-primary-foreground" },
          { key: "출퇴근", label: "출퇴근",   activeClass: "bg-emerald-600 text-white" },
          { key: "개인사용", label: "개인사용", activeClass: "bg-orange-500 text-white" },
        ].map(({ key, label, activeClass }) => (
          <Link key={key}
            href={`/my-trips${searchParams.month ? `?month=${searchParams.month}&` : "?"}${key ? `type=${key}` : ""}`}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors
              ${activeType === key ? activeClass : "bg-muted text-muted-foreground"}`}>
            {label}
          </Link>
        ))}
        <span className="text-muted-foreground self-center mx-1">|</span>
        {[{ key: "", label: "전체상태" }, { key: "draft", label: "작성중" }, { key: "submitted", label: "승인대기" }, { key: "approved", label: "승인완료" }].map(({ key, label }) => (
          <Link key={`s-${key}`}
            href={`/my-trips${searchParams.month ? `?month=${searchParams.month}&` : "?"}${key ? `status=${key}` : ""}`}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors
              ${(searchParams.status ?? "") === key ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
            {label}
          </Link>
        ))}
      </div>

      {/* 기록 목록 */}
      {!trips?.length ? (
        <div className="px-4 py-12 text-center text-muted-foreground text-sm">이번 달 운행 기록이 없습니다</div>
      ) : (
        <div className="px-4 space-y-3">
          {trips.map(trip => {
            const dep = new Date(trip.departure_time);
            const statusInfo = STATUS_LABEL[trip.status] ?? STATUS_LABEL.draft;
            const isOngoing  = !trip.arrival_time;
            const tripType   = trip.trip_type ?? "업무";
            const ts = TYPE_STYLE[tripType] ?? TYPE_STYLE["업무"];
            return (
              <div key={trip.id} className={`rounded-2xl border p-4 space-y-3 ${ts.card}`}>
                <Link href={isOngoing ? `/trip/${trip.id}/end` : `/trip/${trip.id}/complete`}
                  className="block space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${ts.badge}`}>
                        {ts.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {dep.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric", weekday: "short" })}
                      </span>
                    </div>
                    <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${statusInfo.className}`}>
                      {isOngoing ? "운행중" : statusInfo.text}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium truncate flex-1">{trip.departure_location}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium truncate flex-1 text-right">{trip.arrival_location ?? "—"}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{trip.distance_km !== null ? `${trip.distance_km.toLocaleString("ko-KR")}km` : "진행중"}</span>
                    {trip.toll_fee > 0 && <span>{trip.toll_fee.toLocaleString("ko-KR")}원</span>}
                    <span className="truncate">{trip.purpose}</span>
                  </div>
                </Link>
                {/* draft이고 완료된 기록만 수정/삭제 버튼 표시 */}
                {trip.status === "draft" && !isOngoing && (
                  <TripActionButtons tripId={trip.id} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
