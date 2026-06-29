import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MobileHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: driver } = await supabase
    .from("drivers").select("id, name").eq("user_id", user.id).single();

  const { data: activeTrip } = driver
    ? await supabase.from("trip_logs")
        .select("id, departure_time, departure_location, departure_km, purpose, trip_type")
        .eq("driver_id", driver.id).is("arrival_time", null).eq("status", "draft")
        .order("departure_time", { ascending: false }).limit(1).maybeSingle()
    : { data: null };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const { data: monthlyStats } = driver
    ? await supabase.from("trip_logs")
        .select("distance_km, toll_fee, status, trip_type, arrival_time")
        .eq("driver_id", driver.id)
        .gte("departure_time", monthStart).lt("departure_time", monthEnd)
    : { data: null };

  const bizStats      = monthlyStats?.filter(t => (t.trip_type ?? "업무") === "업무") ?? [];
  const commuteStats  = monthlyStats?.filter(t => t.trip_type === "출퇴근") ?? [];
  const personalStats = monthlyStats?.filter(t => t.trip_type === "개인사용") ?? [];

  const stats = {
    bizDistance: bizStats.reduce((s, t) => s + (t.distance_km ?? 0), 0),
    bizToll:     bizStats.reduce((s, t) => s + (t.toll_fee ?? 0), 0),
    comDistance: commuteStats.reduce((s, t) => s + (t.distance_km ?? 0), 0),
    comToll:     commuteStats.reduce((s, t) => s + (t.toll_fee ?? 0), 0),
    perDistance: personalStats.reduce((s, t) => s + (t.distance_km ?? 0), 0),
    perToll:     personalStats.reduce((s, t) => s + (t.toll_fee ?? 0), 0),
    // 완료된(arrival_time 있음) draft 건수 → 미제출
    unsubmitted: (monthlyStats ?? []).filter(t => t.status === "draft" && t.arrival_time !== null).length,
  };

  const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;

  // 진행 중 배너 색상
  const activeBg =
    activeTrip?.trip_type === "출퇴근"   ? "bg-emerald-600" :
    activeTrip?.trip_type === "개인사용" ? "bg-orange-500"  : "bg-primary";
  const activeEmoji =
    activeTrip?.trip_type === "출퇴근"   ? "🏠" :
    activeTrip?.trip_type === "개인사용" ? "👤" : "🚗";
  const activeLabel =
    activeTrip?.trip_type === "출퇴근"   ? "출퇴근 중" :
    activeTrip?.trip_type === "개인사용" ? "개인사용 운행 중" : "업무 운행 중";

  return (
    <div className="p-4 space-y-4 pb-6">
      {/* 진행 중 운행 배너 */}
      {activeTrip && (
        <Link href={`/trip/${activeTrip.id}/end`}
          className={`block rounded-2xl p-5 shadow-lg ${activeBg} text-white`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs opacity-70">{activeLabel}</p>
              <p className="text-lg font-bold mt-0.5">{activeTrip.departure_location}</p>
              <p className="text-sm opacity-80">{activeTrip.purpose}</p>
            </div>
            <div className="text-4xl">{activeEmoji}</div>
          </div>
          <div className="mt-4 bg-white/15 rounded-xl py-2.5 text-center text-sm font-semibold">
            도착 등록하기 →
          </div>
        </Link>
      )}

      {/* 미제출 알림 */}
      {stats.unsubmitted > 0 && (
        <Link href="/my-trips?status=draft"
          className="flex items-center justify-between text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span>⚠️ 미제출 기록 <strong>{stats.unsubmitted}건</strong> — 확인 및 제출하기</span>
          <span>→</span>
        </Link>
      )}

      {/* 업무 운행 집계 */}
      <div className="rounded-2xl bg-background border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">🚗 {monthLabel} 업무 운행</h2>
          <span className="text-xs text-muted-foreground">{bizStats.length}건</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: "운행거리", value: stats.bizDistance.toLocaleString("ko-KR"), unit: "km" },
            { label: "통행료",   value: stats.bizToll.toLocaleString("ko-KR"),     unit: "원" },
          ].map(({ label, value, unit }) => (
            <div key={label} className="rounded-xl bg-muted p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold">{value}<span className="text-xs font-normal ml-1">{unit}</span></p>
            </div>
          ))}
        </div>
      </div>

      {/* 출퇴근 집계 */}
      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-emerald-800">🏠 {monthLabel} 출퇴근</h2>
          <span className="text-xs text-emerald-600">{commuteStats.length}건</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: "운행거리",   value: stats.comDistance.toLocaleString("ko-KR"), unit: "km" },
            { label: "통행료(개인)", value: stats.comToll.toLocaleString("ko-KR"),   unit: "원" },
          ].map(({ label, value, unit }) => (
            <div key={label} className="rounded-xl bg-emerald-100 p-3">
              <p className="text-xs text-emerald-600">{label}</p>
              <p className="text-xl font-bold text-emerald-800">{value}<span className="text-xs font-normal ml-1">{unit}</span></p>
            </div>
          ))}
        </div>
      </div>

      {/* 개인사용 집계 */}
      <div className="rounded-2xl bg-orange-50 border border-orange-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-orange-800">👤 {monthLabel} 개인사용</h2>
          <span className="text-xs text-orange-500">{personalStats.length}건 · 개인 부담</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: "운행거리",   value: stats.perDistance.toLocaleString("ko-KR"), unit: "km" },
            { label: "통행료(개인)", value: stats.perToll.toLocaleString("ko-KR"),   unit: "원" },
          ].map(({ label, value, unit }) => (
            <div key={label} className="rounded-xl bg-orange-100 p-3">
              <p className="text-xs text-orange-600">{label}</p>
              <p className="text-xl font-bold text-orange-800">{value}<span className="text-xs font-normal ml-1">{unit}</span></p>
            </div>
          ))}
        </div>
      </div>

      {/* 내 기록 바로가기 */}
      <Link href="/my-trips"
        className="flex items-center justify-between bg-background border border-border rounded-2xl px-4 py-3">
        <span className="text-sm font-medium">내 운행 기록 전체 보기</span>
        <span>→</span>
      </Link>

      {/* 운행 시작 버튼 — 진행 중 운행 없을 때만 표시 */}
      {!activeTrip && (
        <Link href="/trip/start"
          className="flex items-center justify-center gap-2 w-full rounded-2xl bg-primary text-primary-foreground py-4 text-base font-semibold shadow-md">
          🚗 운행 시작
        </Link>
      )}
    </div>
  );
}
