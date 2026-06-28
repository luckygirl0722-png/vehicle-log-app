"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ApprovalModal from "./ApprovalModal";

interface Trip {
  id:                 string;
  status:             string;
  trip_type:          string | null;
  departure_time:     string;
  departure_location: string;
  arrival_location:   string | null;
  distance_km:        number | null;
  toll_fee:           number;
  purpose:            string;
  note:               string | null;
  departure_km:       number;
  arrival_km:         number | null;
  vehicle_id:         string;
  driver_id:          string;
  vehicles: { id: string; plate_number: string; model: string } | null;
  drivers:  { id: string; name: string; employee_no: string; department: string } | null;
}

interface ApprovalClientProps { trips: Trip[]; }

const TYPE_BADGE: Record<string, string> = {
  "업무":     "bg-blue-100 text-blue-700",
  "출퇴근":   "bg-emerald-100 text-emerald-700",
  "개인사용": "bg-orange-100 text-orange-700",
};

const selClass = "h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

export default function ApprovalClient({ trips }: ApprovalClientProps) {
  const router = useRouter();
  const [selected, setSelected]     = useState<Trip | null>(null);
  const [modalOpen, setModalOpen]   = useState(false);
  const [filterMonth, setFilterMonth]       = useState("");
  const [filterVehicle, setFilterVehicle]   = useState("");
  const [filterDriver, setFilterDriver]     = useState("");
  const [isPending, startTransition]        = useTransition();
  const [bulkResult, setBulkResult]         = useState<string | null>(null);
  const [confirmBulk, setConfirmBulk]       = useState(false);

  function openModal(trip: Trip) { setSelected(trip); setModalOpen(true); }

  const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  // ── 필터 옵션 도출 ──────────────────────────────────────
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    trips.forEach(t => {
      const d = new Date(t.departure_time);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      set.add(key);
    });
    return Array.from(set).sort().reverse().map(v => ({
      value: v,
      label: `${v.split("-")[0]}년 ${parseInt(v.split("-")[1])}월`,
    }));
  }, [trips]);

  const vehicleOptions = useMemo(() => {
    const map = new Map<string, string>();
    trips.forEach(t => {
      if (t.vehicles?.id) map.set(t.vehicles.id, t.vehicles.plate_number);
    });
    return Array.from(map.entries()).map(([id, plate]) => ({ id, plate }));
  }, [trips]);

  const driverOptions = useMemo(() => {
    const map = new Map<string, string>();
    trips.forEach(t => {
      if (t.drivers?.id) map.set(t.drivers.id, t.drivers.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [trips]);

  // ── 필터 적용 ──────────────────────────────────────────
  const filteredTrips = useMemo(() => {
    return trips.filter(t => {
      if (filterMonth) {
        const d = new Date(t.departure_time);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (key !== filterMonth) return false;
      }
      if (filterVehicle && t.vehicle_id !== filterVehicle) return false;
      if (filterDriver  && t.driver_id  !== filterDriver)  return false;
      return true;
    });
  }, [trips, filterMonth, filterVehicle, filterDriver]);

  const isFiltered = !!(filterMonth || filterVehicle || filterDriver);
  const filteredIds = filteredTrips.map(t => t.id);

  // ── 그룹 라벨 (필터 조합 설명) ─────────────────────────
  const groupLabel = useMemo(() => {
    const parts: string[] = [];
    if (filterMonth) {
      const mo = monthOptions.find(m => m.value === filterMonth);
      if (mo) parts.push(mo.label);
    }
    if (filterVehicle) {
      const v = vehicleOptions.find(v => v.id === filterVehicle);
      if (v) parts.push(v.plate);
    }
    if (filterDriver) {
      const d = driverOptions.find(d => d.id === filterDriver);
      if (d) parts.push(d.name);
    }
    return parts.length ? parts.join(" / ") : "전체";
  }, [filterMonth, filterVehicle, filterDriver, monthOptions, vehicleOptions, driverOptions]);

  // ── 일괄 승인 ───────────────────────────────────────────
  async function handleBulkApprove() {
    setBulkResult(null);
    startTransition(async () => {
      let ok = 0;
      for (const id of filteredIds) {
        const res = await fetch(`/api/trips/${id}/approve`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approved", comment: `일괄 승인 (${groupLabel})` }),
        });
        if (res.ok) ok++;
      }
      setBulkResult(`${ok}건 승인 완료`);
      setConfirmBulk(false);
      setTimeout(() => { router.refresh(); setBulkResult(null); }, 1500);
    });
  }

  if (trips.length === 0) {
    return (
      <div className="rounded-xl border bg-background p-12 text-center space-y-3">
        <div className="text-4xl">✅</div>
        <p className="font-semibold text-foreground">모두 처리되었습니다</p>
        <p className="text-sm text-muted-foreground">승인 대기 중인 기록이 없습니다</p>
      </div>
    );
  }

  return (
    <>
      {/* ── 필터 바 ── */}
      <div className="rounded-xl border bg-background p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          {/* 월 */}
          <select className={selClass} value={filterMonth}
            onChange={e => { setFilterMonth(e.target.value); setConfirmBulk(false); }}>
            <option value="">전체 월</option>
            {monthOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* 차량 */}
          <select className={selClass} value={filterVehicle}
            onChange={e => { setFilterVehicle(e.target.value); setConfirmBulk(false); }}>
            <option value="">전체 차량</option>
            {vehicleOptions.map(v => (
              <option key={v.id} value={v.id}>{v.plate}</option>
            ))}
          </select>

          {/* 운전자 */}
          <select className={selClass} value={filterDriver}
            onChange={e => { setFilterDriver(e.target.value); setConfirmBulk(false); }}>
            <option value="">전체 운전자</option>
            {driverOptions.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {isFiltered && (
            <button
              onClick={() => { setFilterMonth(""); setFilterVehicle(""); setFilterDriver(""); setConfirmBulk(false); }}
              className="h-8 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground border border-input bg-background">
              초기화
            </button>
          )}
        </div>

        {/* 일괄 승인 영역 */}
        <div className="border-t pt-3">
          {bulkResult ? (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-700 font-medium text-center">
              ✅ {bulkResult}
            </div>
          ) : confirmBulk ? (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
              <p className="text-sm font-medium text-amber-800">
                <span className="font-bold">{groupLabel}</span> 승인 대기{" "}
                <span className="font-bold text-amber-700">{filteredIds.length}건</span>을 일괄 승인합니다.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmBulk(false)}
                  className="flex-1 rounded-lg border border-border py-1.5 text-sm bg-background">취소</button>
                <button onClick={handleBulkApprove} disabled={isPending}
                  className="flex-1 rounded-lg bg-emerald-600 text-white py-1.5 text-sm font-medium disabled:opacity-50">
                  {isPending ? "처리 중..." : "승인 확정"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {isFiltered
                  ? <><span className="font-semibold text-foreground">{groupLabel}</span> — {filteredTrips.length}건</>
                  : <><span className="font-semibold text-amber-600">전체</span> {filteredTrips.length}건</>
                }
              </span>
              {filteredIds.length > 0 && (
                <button onClick={() => setConfirmBulk(true)}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-emerald-700 transition-colors">
                  ✅ {filteredIds.length}건 일괄 승인
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 기록 목록 ── */}
      {filteredTrips.length === 0 ? (
        <div className="rounded-xl border bg-background p-10 text-center text-sm text-muted-foreground">
          해당 조건의 승인 대기 기록이 없습니다
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTrips.map(trip => (
            <div key={trip.id}
              className="rounded-xl border bg-background p-4 space-y-3 hover:shadow-sm transition-shadow">
              {/* 헤더 */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{trip.drivers?.name ?? "—"}</span>
                    <span className="text-xs text-muted-foreground">{trip.drivers?.department}</span>
                    {trip.trip_type && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE[trip.trip_type] ?? "bg-gray-100 text-gray-600"}`}>
                        {trip.trip_type}
                      </span>
                    )}
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

              {/* 통계 + 검토 버튼 */}
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
          ))}
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
