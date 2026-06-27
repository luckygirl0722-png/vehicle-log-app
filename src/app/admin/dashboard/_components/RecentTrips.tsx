import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const STATUS_BADGE: Record<string, { variant: "default"|"secondary"|"outline"|"destructive"|"success"|"warning"; label: string }> = {
  draft:     { variant: "outline",     label: "작성중" },
  submitted: { variant: "warning",     label: "승인대기" },
  approved:  { variant: "success",     label: "승인완료" },
  rejected:  { variant: "destructive", label: "반려됨" },
};

interface Trip {
  id: string;
  status: string;
  departure_time: string;
  departure_location: string;
  arrival_location: string | null;
  distance_km: number | null;
  vehicles: { plate_number: string } | null;
  drivers:  { name: string } | null;
}

interface RecentTripsProps {
  trips: Trip[];
}

export default function RecentTrips({ trips }: RecentTripsProps) {
  if (!trips.length) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        최근 운행 기록이 없습니다
      </p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {trips.map(trip => {
        const st  = STATUS_BADGE[trip.status] ?? STATUS_BADGE.draft;
        const dep = new Date(trip.departure_time);
        return (
          <Link key={trip.id} href={`/admin/trips`}
            className="flex items-center justify-between py-3 hover:bg-muted/30 px-1 rounded transition-colors group">
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {trip.departure_location}
                  <span className="text-muted-foreground mx-1">→</span>
                  {trip.arrival_location ?? "운행중"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{trip.vehicles?.plate_number ?? "—"}</span>
                <span>·</span>
                <span>{trip.drivers?.name ?? "—"}</span>
                <span>·</span>
                <span>{dep.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}</span>
                {trip.distance_km !== null && (
                  <><span>·</span><span>{trip.distance_km.toLocaleString("ko-KR")} km</span></>
                )}
              </div>
            </div>
            <Badge variant={st.variant} className="ml-3 shrink-0">{st.label}</Badge>
          </Link>
        );
      })}
      <div className="pt-3">
        <Link href="/admin/trips"
          className="text-sm text-primary hover:underline">
          전체 기록 보기 →
        </Link>
      </div>
    </div>
  );
}
