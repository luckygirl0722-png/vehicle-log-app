"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ApprovalModal from "./ApprovalModal";

interface Trip {
  id: string;
  status: string;
  departure_time: string;
  departure_location: string;
  arrival_location: string | null;
  distance_km: number | null;
  toll_fee: number;
  purpose: string;
  note: string | null;
  departure_km: number;
  arrival_km: number | null;
  vehicles: { plate_number: string; model: string } | null;
  drivers:  { name: string; employee_no: string; department: string } | null;
}

interface ApprovalClientProps {
  trips: Trip[];
}

export default function ApprovalClient({ trips }: ApprovalClientProps) {
  const [selected, setSelected]   = useState<Trip | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function openModal(trip: Trip) { setSelected(trip); setModalOpen(true); }

  const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">승인 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            승인 대기 <span className="font-semibold text-amber-600">{trips.length}건</span>
          </p>
        </div>
      </div>

      {trips.length === 0 ? (
        <div className="rounded-xl border bg-background p-12 text-center space-y-3">
          <div className="text-4xl">✅</div>
          <p className="font-semibold text-foreground">모두 처리되었습니다</p>
          <p className="text-sm text-muted-foreground">승인 대기 중인 기록이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map(trip => {
            const dep = new Date(trip.departure_time);
            return (
              <div key={trip.id}
                className="rounded-xl border bg-background p-4 space-y-3 hover:shadow-sm transition-shadow">
                {/* 헤더 행 */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {trip.drivers?.name ?? "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {trip.drivers?.department}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {trip.vehicles?.plate_number} · {fmt(trip.departure_time)}
                    </p>
                  </div>
                  <Badge variant="warning" className="shrink-0">승인대기</Badge>
                </div>

                {/* 경로 */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium truncate flex-1">{trip.departure_location}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted-foreground">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                  <span className="font-medium truncate flex-1 text-right">
                    {trip.arrival_location ?? "—"}
                  </span>
                </div>

                {/* 통계 */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {trip.distance_km !== null && (
                      <span>📍 {trip.distance_km.toLocaleString("ko-KR")}km</span>
                    )}
                    {trip.toll_fee > 0 && (
                      <span>🛣 {trip.toll_fee.toLocaleString("ko-KR")}원</span>
                    )}
                    <span className="truncate max-w-32">{trip.purpose}</span>
                  </div>
                  <Button size="sm" onClick={() => openModal(trip)}>
                    검토하기
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ApprovalModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        trip={selected}
      />
    </>
  );
}
