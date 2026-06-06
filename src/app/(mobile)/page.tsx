import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import LogoutButton from "@/components/auth/LogoutButton";

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
        .select("distance_km, toll_fee, status, trip_type")
        .eq("driver_id", driver.id)
        .gte("departure_time", monthStart).lt("departure_time", monthEnd)
    : { data: null };

  const bizStats     = monthlyStats?.filter(t => (t.trip_type ?? "업무") === "업무") ?? [];
  const commuteStats = monthlyStats?.filter(t => t.trip_type === "출퇴근") ?? [];

  const stats = {
    count:       monthlyStats?.length ?? 0,
    bizDistance: bizStats.reduce((s, t) => s + (t.distance_km ?? 0), 0),
    bizToll:     bizStats.reduce((s, t) => s + (t.toll_fee ?? 0), 0),
    comDistance: commuteStats.reduce((s, t) => s + (t.distance_km ?? 0), 0),
    comToll:     commuteStats.reduce((s, t) => s + (t.toll_fee ?? 0), 0),
    unsubmitted: bizStats.filter(t => t.status === "draft" && t.distance_km !== null).length,
  };

  const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;

  return (
    <div className="p-4 space-y-4 pb-6">
      {/* 진행 중 운행 배너 */}
      {activeTrip ? (
        <Link href={`/trip/${activeTrip.id}/end`}
          className={`block rounded-2xl p-5 shadow-lg ${activeTrip.trip_type === "출퇴근" ? "bg-emerald-600" : "bg-primary"} text-white`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs opacity-70">{activeTrip.trip_type === "출퇴근" ? "출퇴근 중" : "업무 운행 중"}</p>
              <p className="text-lg font-bold mt-0.5">{activeTrip.departure_location}</p>
              <p className="text-sm opacity-80">{activeTrip.purpose}</p>
            </div>
            <div className="text-4xl">{activeTrip.trip_type === "출퇴근" ? "🏠" : "🚗"}</div>
          </div>
          <div className="mt-4 bg-white/15 rounded-xl py-2.5 text-center text-sm font-semibold">
            도착 등록하기 →
          </div>
        </Link>
      ) : (
        <Link href="/trip/start"
          className="block rounded-2xl border-2 border-dashed border-primary/40 p-6 text-center space-y-2">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
            <span className="text-2xl">🚗</span>
          </div>
          <p className="font-semibold text-foreground">운행 시작</p>
          <p className="text-sm text-muted-foreground">탭하여 출발 정보를 등록하세요</p>
        </Link>
      )}

      {/* 업무 운행 집계 */}
      <div className="rounded-2xl bg-background border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">{monthLabel} 업무 운행</h2>
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
        {stats.unsubmitted > 0 && (
          <Link href="/my-trips?status=draft"
            className="mt-3 flex items-center justify-between text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            <span>미제출 {stats.unsubmitted}건 — 지금 제출하기</span>
            <span>→</span>
          </Link>
        )}
      </div>

      {/* 출퇴근 집계 */}
      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-emerald-800">{monthLabel} 출퇴근</h2>
          <span className="text-xs text-emerald-600">{commuteStats.length}건 · 개인사용</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: "출퇴근 거리", value: stats.comDistance.toLocaleString("ko-KR"), unit: "km" },
            { label: "통행료(개인)", value: stats.comToll.toLocaleString("ko-KR"),    unit: "원" },
          ].map(({ label, value, unit }) => (
            <div key={label} className="rounded-xl bg-emerald-100 p-3">
              <p className="text-xs text-emerald-600">{label}</p>
              <p className="text-xl font-bold text-emerald-800">{value}<span className="text-xs font-normal ml-1">{unit}</span></p>
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
    </div>
  );
}
