"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_BADGE: Record<string, { variant: "default"|"secondary"|"success"|"destructive"|"warning"|"outline"; label: string }> = {
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
  departure_km: number;
  arrival_time: string | null;
  arrival_location: string | null;
  arrival_km: number | null;
  distance_km: number | null;
  purpose: string;
  toll_fee: number;
  note: string | null;
  vehicles: { plate_number: string; model: string } | null;
  drivers:  { name: string; employee_no: string } | null;
}

interface TripDetailModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trip: Trip | null;
}

export default function TripDetailModal({ open, onOpenChange, trip }: TripDetailModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError]   = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [action, setAction]   = useState<"approve" | "reject" | null>(null);

  if (!trip) return null;

  const statusInfo = STATUS_BADGE[trip.status] ?? STATUS_BADGE.draft;
  const depTime    = new Date(trip.departure_time);
  const arrTime    = trip.arrival_time ? new Date(trip.arrival_time) : null;

  const fmt = (d: Date) =>
    d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  async function handleApproval(act: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      // approvals 테이블에 직접 삽입 (TASK_12 승인 API 사용)
      const res = await fetch(`/api/trips/${trip.id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act, comment }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "처리 실패"); return; }
      setAction(null);
      setComment("");
      onOpenChange(false);
      router.refresh();
    });
  }

  const rows: [string, string][] = [
    ["차량",    `${trip.vehicles?.plate_number ?? "—"} · ${trip.vehicles?.model ?? ""}`],
    ["운전자",  `${trip.drivers?.name ?? "—"} (${trip.drivers?.employee_no ?? ""})`],
    ["출발지",  trip.departure_location],
    ["출발 km", `${trip.departure_km.toLocaleString("ko-KR")} km`],
    ["도착지",  trip.arrival_location ?? "운행 중"],
    ["도착 km", trip.arrival_km !== null ? `${trip.arrival_km.toLocaleString("ko-KR")} km` : "—"],
    ["운행거리", trip.distance_km !== null ? `${trip.distance_km.toLocaleString("ko-KR")} km` : "—"],
    ["출발시각", fmt(depTime)],
    ["도착시각", arrTime ? fmt(arrTime) : "—"],
    ["업무목적", trip.purpose],
    ["통행료",   trip.toll_fee > 0 ? `${trip.toll_fee.toLocaleString("ko-KR")}원` : "없음"],
    ["비고",     trip.note ?? "—"],
  ];

  return (
    <Dialog open={open} onOpenChange={v => { setAction(null); setError(null); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>운행 기록 상세</DialogTitle>
            <Badge variant={statusInfo.variant as any}>{statusInfo.label}</Badge>
          </div>
        </DialogHeader>

        {/* 상세 정보 */}
        <div className="rounded-lg border divide-y text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex px-3 py-2 gap-4">
              <span className="text-muted-foreground w-20 shrink-0">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>

        {/* 승인/반려 액션 (submitted 상태만) */}
        {trip.status === "submitted" && (
          <div className="space-y-3 pt-2">
            {action ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {action === "approve" ? "✅ 승인 코멘트" : "❌ 반려 사유"}
                  <span className="text-muted-foreground text-xs ml-1">(선택)</span>
                </p>
                <textarea
                  rows={2}
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder={action === "approve" ? "승인 확인 완료" : "반려 사유를 입력하세요"}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm" variant="outline" className="flex-1"
                    onClick={() => { setAction(null); setComment(""); }}
                    disabled={isPending}
                  >
                    취소
                  </Button>
                  <Button
                    size="sm"
                    variant={action === "approve" ? "default" : "destructive"}
                    className="flex-1"
                    onClick={() => handleApproval(action === "approve" ? "approved" : "rejected")}
                    disabled={isPending}
                  >
                    {isPending ? "처리 중..." : action === "approve" ? "승인 확정" : "반려 확정"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => setAction("approve")}>
                  ✅ 승인
                </Button>
                <Button size="sm" variant="destructive" className="flex-1" onClick={() => setAction("reject")}>
                  ❌ 반려
                </Button>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
        )}

        <DialogFooter>
          <DialogClose>
            <Button variant="outline">닫기</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
