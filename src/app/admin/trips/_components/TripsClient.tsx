"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import TripDetailModal from "./TripDetailModal";

const STATUS_BADGE: Record<string, { variant: string; label: string }> = {
  draft:     { variant: "outline",     label: "작성중" },
  submitted: { variant: "warning",     label: "승인대기" },
  approved:  { variant: "success",     label: "승인완료" },
  rejected:  { variant: "destructive", label: "반려됨" },
};

const TRIP_TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  업무:     { bg: "bg-blue-100",   text: "text-blue-700",  label: "업무" },
  출퇴근:   { bg: "bg-green-100",  text: "text-green-700", label: "출퇴근" },
  개인사용: { bg: "bg-orange-100", text: "text-orange-700",label: "개인사용" },
};

interface Trip {
  id: string;
  status: string;
  trip_type: string | null;
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
  const router = useRouter();
  const [selectedTrip, setSelectedTrip]   = useState<Trip | null>(null);
  const [xlsxPending, startXlsx]          = useTransition();
  const [xlsxMsg, setXlsxMsg]             = useState<string | null>(null);
  const [logbookPending, setLogbookPending] = useState(false);
  const [logbookMsg, setLogbookMsg]         = useState<string | null>(null);

  async function handleExcelDownload() {
    setXlsxMsg(null);
    // page.tsx가 이미 빌드한 currentParams 재사용
    startXlsx(async () => {
      const res = await fetch(`/api/reports/excel/trips${currentParams ? `?${currentParams}` : ""}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setXlsxMsg(d.error ?? "다운로드 실패");
        setTimeout(() => setXlsxMsg(null), 4000);
        return;
      }
      const blob = await res.blob();
      const cd   = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename\*=UTF-8''(.+)/i);
      const fn   = match ? decodeURIComponent(match[1]) : "운행현황.xlsx";
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = fn;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      setXlsxMsg("다운로드 완료!");
      setTimeout(() => setXlsxMsg(null), 3000);
    });
  }
  async function handleLogbookDownload() {
    setLogbookMsg(null);
    setLogbookPending(true);
    try {
      const url = `/api/reports/excel/logbook?${currentParams}`;
      console.log("[logbook] 요청 URL:", url);
      const res = await fetch(url);
      console.log("[logbook] 응답 status:", res.status, res.ok);
      if (!res.ok) {
        // 응답 텍스트를 읽은 뒤 JSON 파싱 시도
        const text = await res.text().catch(() => "");
        console.log("[logbook] 오류 응답 내용:", text.slice(0, 300));
        let errMsg: string;
        try {
          const d = JSON.parse(text);
          errMsg = d.error ?? `HTTP ${res.status}`;
        } catch {
          // JSON이 아닌 경우(HTML 500 등) → 상태 코드 표시
          errMsg = `HTTP ${res.status}: ${text.slice(0, 120).replace(/<[^>]+>/g, "").trim() || "서버 오류"}`;
        }
        setLogbookMsg(errMsg);
        setTimeout(() => setLogbookMsg(null), 8000);
        return;
      }
      const blob = await res.blob();
      const cd   = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename\*=UTF-8''(.+)/i);
      const fn   = match ? decodeURIComponent(match[1]) : "차량운행기록부.xlsx";
      const blobUrl = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = blobUrl; a.download = fn;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(blobUrl);
      setLogbookMsg("운행기록부 다운로드 완료!");
      setTimeout(() => setLogbookMsg(null), 3000);
    } finally {
      setLogbookPending(false);
    }
  }

  const [modalOpen, setModalOpen]         = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState<Trip | null>(null);
  const [deleteOpen, setDeleteOpen]       = useState(false);
  const [deleteError, setDeleteError]     = useState<string | null>(null);
  const [isPending, startTransition]      = useTransition();

  function openDetail(trip: Trip) {
    setSelectedTrip(trip);
    setModalOpen(true);
  }

  function openDelete(trip: Trip) {
    setDeleteTarget(trip);
    setDeleteError(null);
    setDeleteOpen(true);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const res = await fetch(`/api/trips/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error ?? "삭제 실패");
        return;
      }
      setDeleteOpen(false);
      setDeleteTarget(null);
      router.refresh();
    });
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  // 페이지 URL 생성
  const pageUrl = (p: number) => {
    const params = new URLSearchParams(currentParams);
    params.set("page", String(p));
    return `/admin/trips?${params.toString()}`;
  };

  // 차량 + 월이 모두 지정된 경우에만 운행기록부 다운로드 가능
  const cpObj       = new URLSearchParams(currentParams);
  const canLogbook  = !!(cpObj.get("vehicle_id") && cpObj.get("month"));

  return (
    <>
      {/* 툴바: Excel 다운로드 */}
      <div className="flex items-center justify-end gap-3 mb-2 flex-wrap">
        {(xlsxMsg || logbookMsg) && (
          <span className={`text-xs ${
            (xlsxMsg ?? logbookMsg ?? "").includes("실패")
              ? "text-destructive"
              : "text-emerald-600"
          }`}>
            {xlsxMsg ?? logbookMsg}
          </span>
        )}

        {/* 운행기록부 양식 다운로드 (차량+월 선택 시) */}
        {canLogbook && (
          <button
            onClick={handleLogbookDownload}
            disabled={logbookPending}
            className="flex items-center gap-1.5 rounded-lg border border-blue-600 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            {logbookPending ? "생성 중..." : "운행기록부 다운로드"}
          </button>
        )}

        {/* 운행현황 Excel 다운로드 */}
        <button
          onClick={handleExcelDownload}
          disabled={xlsxPending || pagination.total === 0}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {xlsxPending ? "생성 중..." : `Excel 다운로드 (${pagination.total.toLocaleString("ko-KR")}건)`}
        </button>
      </div>

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
              {["출발일시","차량","운전자","유형","출발지 → 도착지","출발km","도착km","운행거리","통행료","상태",""].map((h, i) => (
                <th key={i}
                  className={`px-3 py-3 font-medium text-muted-foreground whitespace-nowrap ${i === 10 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trips.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">
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
                    <td className="px-3 py-3 whitespace-nowrap">
                      {trip.trip_type ? (() => {
                        const t = TRIP_TYPE_BADGE[trip.trip_type] ?? { bg: "bg-gray-100", text: "text-gray-600", label: trip.trip_type };
                        return (
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${t.bg} ${t.text}`}>
                            {t.label}
                          </span>
                        );
                      })() : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3 max-w-xs">
                      <span className="truncate block">
                        {trip.departure_location}
                        <span className="text-muted-foreground mx-1">→</span>
                        {trip.arrival_location ?? "운행중"}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs">
                      {trip.departure_km != null
                        ? `${trip.departure_km.toLocaleString("ko-KR")} km`
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs">
                      {trip.arrival_km != null
                        ? `${trip.arrival_km.toLocaleString("ko-KR")} km`
                        : <span className="text-muted-foreground">—</span>}
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
                    <td className="px-3 py-3 text-right space-x-1.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => openDetail(trip)}
                        className="text-xs text-primary hover:underline"
                      >
                        상세
                      </button>
                      <button
                        onClick={() => openDelete(trip)}
                        className="text-xs text-destructive hover:underline"
                      >
                        삭제
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

      {/* 운행기록 상세 모달 */}
      <TripDetailModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        trip={selectedTrip}
      />

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteOpen} onOpenChange={v => { if (!isPending) setDeleteOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>운행 기록 삭제</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">아래 운행 기록을 삭제합니다. 삭제된 데이터는 복구할 수 없습니다.</p>
              <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">차량:</span> <strong>{deleteTarget.vehicles?.plate_number ?? "—"}</strong></p>
                <p><span className="text-muted-foreground">운전자:</span> {deleteTarget.drivers?.name ?? "—"}</p>
                <p><span className="text-muted-foreground">출발일시:</span> {fmt(deleteTarget.departure_time)}</p>
                <p><span className="text-muted-foreground">구간:</span> {deleteTarget.departure_location} → {deleteTarget.arrival_location ?? "운행중"}</p>
                <p>
                  <span className="text-muted-foreground">상태:</span>{" "}
                  <Badge variant={(STATUS_BADGE[deleteTarget.status]?.variant ?? "outline") as any} className="text-xs">
                    {STATUS_BADGE[deleteTarget.status]?.label ?? deleteTarget.status}
                  </Badge>
                </p>
              </div>
              {deleteError && (
                <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{deleteError}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isPending}>취소</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
