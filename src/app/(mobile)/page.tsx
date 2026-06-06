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
        .select("id, departure_time, departure_location, departure_km, purpose")
        .eq("driver_id", driver.id).is("arrival_time", null).eq("status", "draft")
        .order("departure_time", { ascending: false }).limit(1).maybeSingle()
    : { data: null };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const { data: monthlyStats } = driver
    ? await supabase.from("trip_logs").select("distance_km, toll_fee, status")
        .eq("driver_id", driver.id)
        .gte("departure_time", monthStart).lt("departure_time", monthEnd)
    : { data: null };

  const stats = {
    count:       monthlyStats?.length ?? 0,
    distance:    monthlyStats?.reduce((s: number, t: any) => s + (t.distance_km ?? 0), 0) ?? 0,
    toll:        monthlyStats?.reduce((s: number, t: any) => s + (t.toll_fee ?? 0), 0) ?? 0,
    unsubmitted: monthlyStats?.filter((t: any) => t.status === "draft" && t.distance_km !== null).length ?? 0,
  };

  const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;

  return (
    <div className="p-4 space-y-4 pb-6">
      {activeTrip ? (
        <Link href={`/trip/${activeTrip.id}/end`}
          className="block rounded-2xl bg-primary text-primary-foreground p-5 shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-primary-foreground/70">운행 중</p>
              <p className="text-lg font-bold">{activeTrip.departure_location}</p>
              <p className="text-sm text-primary-foreground/80">{activeTrip.purpose}</p>
            </div>
            <div className="text-4xl">🚗</div>
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
          <p className="font-semibold">운행 시작</p>
          <p className="text-sm text-muted-foreground">탭하여 출발 정보를 등록하세요</p>
        </Link>
      )}

      <div className="rounded-2xl bg-background border border-border p-4">
        <h2 className="text-sm font-semibold mb-3">{monthLabel} 현황</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: "운행 건수",  value: `${stats.count}`, unit: "건" },
            { label: "총 운행거리", value: stats.distance.toLocaleString("ko-KR"), unit: "km" },
            { label: "총 통행료",  value: stats.toll.toLocaleString("ko-KR"), unit: "원" },
            { label: "미제출 기록", value: `${stats.unsubmitted}`, unit: "건" },
          ].map(({ label, value, unit }) => (
            <div key={label} className="rounded-xl bg-muted p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold">{value}<span className="text-xs font-normal ml-1">{unit}</span></p>
            </div>
          ))}
        </div>
      </div>

      <Link href="/my-trips"
        className="flex items-center justify-between bg-background border border-border rounded-2xl px-4 py-3">
        <span className="text-sm font-medium">내 운행 기록 전체 보기</span>
        <span>→</span>
      </Link>
    </div>
  );
}
