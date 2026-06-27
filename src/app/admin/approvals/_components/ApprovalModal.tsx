"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

interface ApprovalModalProps {
  open:         boolean;
  onOpenChange: (v: boolean) => void;
  trip:         Trip | null;
}

export default function ApprovalModal({ open, onOpenChange, trip }: ApprovalModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [comment, setComment]  = useState("");
  const [stage, setStage]      = useState<"view" | "approve" | "reject">("view");
  const [error, setError]      = useState<string | null>(null);
  const [result, setResult]    = useState<string | null>(null);

  function reset() { setStage("view"); setComment(""); setError(null); setResult(null); }
  function handleClose(v: boolean) { reset(); onOpenChange(v); }

  if (!trip) return null;

  const dep  = new Date(trip.departure_time);
  const arr  = trip.arrival_location ? new Date(trip.departure_time) : null;
  const fmtDT = (d: Date) => d.toLocaleString("ko-KR", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  async function handleApproval(action: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      const res  = await fetch(`/api/trips/${trip.id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: comment || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "처리 실패"); return; }
      setResult(data._message ?? (action === "approved" ? "승인 완료" : "반려 완료"));
      setTimeout(() => { handleClose(false); router.refresh(); }, 1200);
    });
  }

  const infoRows: [string, string][] = [
    ["운전자",  `${trip.drivers?.name ?? "—"} (${trip.drivers?.employee_no ?? ""})`],
    ["부서",    trip.drivers?.department ?? "—"],
    ["차량",    `${trip.vehicles?.plate_number ?? "—"} · ${trip.vehicles?.model ?? ""}`],
    ["출발",    `${trip.departure_location} (${fmtDT(dep)})`],
    ["도착",    trip.arrival_location ? `${trip.arrival_location}` : "—"],
    ["운행거리",trip.distance_km !== null ? `${trip.distance_km.toLocaleString("ko-KR")} km` : "—"],
    ["출발km",  `${trip.departure_km.toLocaleString("ko-KR")} km`],
    ["도착km",  trip.arrival_km !== null ? `${trip.arrival_km.toLocaleString("ko-KR")} km` : "—"],
    ["통행료",  trip.toll_fee > 0 ? `${trip.toll_fee.toLocaleString("ko-KR")}원` : "없음"],
    ["업무목적",trip.purpose],
    ["비고",    trip.note ?? "—"],
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>승인 검토</DialogTitle>
            <Badge variant="warning">승인대기</Badge>
          </div>
        </DialogHeader>

        {/* 운행 정보 */}
        <div className="rounded-lg border divide-y text-sm max-h-64 overflow-y-auto">
          {infoRows.map(([label, value]) => (
            <div key={label} className="flex px-3 py-2 gap-4">
              <span className="text-muted-foreground w-20 shrink-0">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>

        {/* 결과 메시지 */}
        {result && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 text-center font-medium">
            ✅ {result}
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
        )}

        {/* 승인/반려 액션 */}
        {!result && trip.status === "submitted" && (
          stage === "view" ? (
            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => setStage("approve")}>
                ✅ 승인
              </Button>
              <Button variant="destructive" className="flex-1" onClick={() => setStage("reject")}>
                ❌ 반려
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className={`rounded-lg px-3 py-2 text-sm font-medium
                ${stage === "approve" ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-600 border border-red-200"}`}>
                {stage === "approve" ? "✅ 승인 처리" : "❌ 반려 처리"}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  코멘트 <span className="text-muted-foreground text-xs font-normal">(선택)</span>
                </label>
                <textarea
                  rows={2}
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder={stage === "approve" ? "확인 완료" : "반려 사유를 입력하세요"}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none
                             focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1"
                  onClick={() => { setStage("view"); setComment(""); }} disabled={isPending}>
                  취소
                </Button>
                <Button
                  variant={stage === "approve" ? "default" : "destructive"}
                  className="flex-1"
                  onClick={() => handleApproval(stage === "approve" ? "approved" : "rejected")}
                  disabled={isPending}
                >
                  {isPending ? "처리 중..." : stage === "approve" ? "승인 확정" : "반려 확정"}
                </Button>
              </div>
            </div>
          )
        )}

        <DialogFooter>
          <DialogClose><Button variant="outline">닫기</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
