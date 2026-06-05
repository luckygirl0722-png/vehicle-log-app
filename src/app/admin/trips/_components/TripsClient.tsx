"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import TripDetailModal from "./TripDetailModal";

const STATUS_BADGE: Record<string, { variant: string; label: string }> = {
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
  arrival_time: string | null;
  departure_km: number;
  arrival_km: number | null;
  distance_km: number | null;
  purpose: string;
  toll_fee: number;
  note: string | null;
  vehicles: { plate_number: string; model: string } | null;
  drivers:  { name: string; employee_no: string } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface TripsClientProps {
  trips: Trip[];
  pagination: Pagination;
  summary: { totalDistance: number; totalToll: number; submittedCount: number };
  currentParams: string;
}

export default function TripsClient({ trips, pagination, summary, currentParams }: TripsClientProps) {
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [modalOpen, setModalOpen]       = useState(false);

  function openDetail(trip: Trip) {
    setSelectedTrip(trip);
    setModalOpen(true);
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  // 페이지 URL 생성
  const pageUrl = (p: number) => {
    const params = new URLSearchParams(currentParams);
    params.set("page", String(p));
    return `/admin/trips?${params.toString()}`;
  };

  return (
    <>
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "총 운행 건수",  value: pagination.total.toLocaleString("ko-KR"),      unit: "건" },
          { label: "총 운행거리",   value: summary.totalDistance.toLocaleString("ko-KR"),  unit: "km" },
          { label: "승인 대기",     value: summary.submittedCount.toLocaleString("ko-KR"), unit: "건",
            highlight: summary.submittedCount > 0 },
        ].map(({ label, value, unit, highlight }) => (
          <div key={label}
            className={`rounded-xl border p-4 ${highlight ? "border-amber-200 bg-amber-50" : "bg-background border-border"}`}>
            <p className={`text-xs mb-1 ${highlight ? "text-amber-600" : "text-muted-foreground"}`}>{label}</p>
            <p className={`text-2xl font-bold ${highlight ? "text-amber-700" : "text-foreground"}`}>
              {value} <span className="text-sm font-normal">{unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* 테이블 */}
      <div className="rounded-lg border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {["출발일시","차량","운전자","출발지 → 도착지","운행거리","통행료","상태",""].map((h, i) => (
                <th key={i}
                  className={`px-3 py-3 font-medium text-muted-foreground whitespace-nowrap ${i === 7 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trips.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  조건에 맞는 운행 기록이 없습니다
                </td>
              </tr>
            ) : (
              trips.map(trip => {
                const st = STATUS_BADGE[trip.status] ?? STATUS_BADGE.draft;
                return (
                  <tr key={trip.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => openDetail(trip)}>
                    <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {fmt(trip.departure_time)}
                    </td>
                    <td className="px-3 py-3 font-medium whitespace-nowrap">
                      {trip.vehicles?.plate_number ?? "—"}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {trip.drivers?.name ?? "—"}
                    </td>
                    <td className="px-3 py-3 max-w-xs">
                      <span className="truncate block">
                        {trip.departure_location}
                        <span className="text-muted-foreground mx-1">→</span>
                        {trip.arrival_location ?? "운행중"}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {trip.distance_km !== null
                        ? `${trip.distance_km.toLocaleString("ko-KR")} km`
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {trip.toll_fee > 0
                        ? `${trip.toll_fee.toLocaleString("ko-KR")}원`
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={st.variant as any}>{st.label}</Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={e => { e.stopPropagation(); openDetail(trip); }}
                        className="text-xs text-primary hover:underline"
                      >
                        상세
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            총 {pagination.total}건 · {pagination.page}/{pagination.totalPages} 페이지
          </p>
          <div className="flex gap-1">
            {pagination.page > 1 && (
              <Link href={pageUrl(pagination.page - 1)}
                className="px-3 py-1.5 text-sm rounded border border-input bg-background hover:bg-muted">
                이전
              </Link>
            )}
            {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
              const p = Math.max(1, pagination.page - 2) + i;
              if (p > pagination.totalPages) return null;
              return (
                <Link key={p} href={pageUrl(p)}
                  className={`px-3 py-1.5 text-sm rounded border ${
                    p === pagination.page
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input bg-background hover:bg-muted"}`}>
                  {p}
                </Link>
              );
            })}
            {pagination.page < pagination.totalPages && (
              <Link href={pageUrl(pagination.page + 1)}
                className="px-3 py-1.5 text-sm rounded border border-input bg-background hover:bg-muted">
                다음
              </Link>
            )}
          </div>
        </div>
      )}

      <TripDetailModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        trip={selectedTrip}
      />
    </>
  );
}
