import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "운행 완료 — 차량 운행일지" };

type Props = { params: { id: string } };

export default async function TripCompletePage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trip } = await supabase
    .from("trip_logs")
    .select("*, vehicles(plate_number, model), drivers(name)")
    .eq("id", params.id)
    .single();

  if (!trip) notFound();
  if (!trip.arrival_time) redirect(`/trip/${params.id}/end`);

  const depTime = new Date(trip.departure_time);
  const arrTime = new Date(trip.arrival_time as string);
  const durationMin = Math.round((arrTime.getTime() - depTime.getTime()) / 60000);
  const hours   = Math.floor(durationMin / 60);
  const minutes = durationMin % 60;
  const durationLabel = hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;

  const timeFormat = (d: Date) =>
    d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const dateFormat = (d: Date) =>
    d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });

  const statusMap: Record<string, string> = {
    draft:     "작성 중 — 월말에 제출해주세요",
    submitted: "승인 대기 중",
    approved:  "승인 완료",
    rejected:  "반려됨 — 수정 후 재제출하세요",
  };

  return (
    <div className="p-4 space-y-5">
      <div className="text-center py-6 space-y-3">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
          <span className="text-4xl">✅</span>
        </div>
        <div>
          <p className="text-xl font-bold">운행 완료!</p>
          <p className="text-sm text-muted-foreground mt-1">{dateFormat(depTime)}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-background border border-border overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
          {[
            { label: "운행거리", value: `${(trip.distance_km ?? 0).toLocaleString("ko-KR")}`, unit: "km" },
            { label: "소요시간", value: durationLabel, unit: "" },
            { label: "통행료", value: trip.toll_fee > 0 ? trip.toll_fee.toLocaleString("ko-KR") : "없음", unit: trip.toll_fee > 0 ? "원" : "" },
          ].map(({ label, value, unit }) => (
            <div key={label} className="flex flex-col items-center py-4 px-2">
              <span className="text-xs text-muted-foreground mb-1">{label}</span>
              <span className="text-lg font-bold">{value}</span>
              {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
            </div>
          ))}
        </div>

        <div className="p-4 space-y-3 text-sm">
          {([
            ["출발지", trip.departure_location],
            ["도착지", trip.arrival_location ?? "—"],
            ["출발 km", `${trip.departure_km.toLocaleString("ko-KR")} km`],
            ["도착 km", `${(trip.arrival_km ?? 0).toLocaleString("ko-KR")} km`],
            ["출발", timeFormat(depTime)],
            ["도착", timeFormat(arrTime)],
            ["목적", trip.purpose],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="flex justify-between items-start gap-4">
              <span className="text-muted-foreground shrink-0 w-16">{label}</span>
              <span className="font-medium text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl px-4 py-3 text-sm font-medium text-center bg-gray-100 text-gray-600">
        {statusMap[trip.status] ?? trip.status}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/"
          className="rounded-xl border border-border bg-background py-3.5 text-center text-sm font-medium">
          홈으로
        </Link>
        <Link href="/my-trips"
          className="rounded-xl bg-primary text-primary-foreground py-3.5 text-center text-sm font-medium">
          내 기록 보기
        </Link>
      </div>
    </div>
  );
}
