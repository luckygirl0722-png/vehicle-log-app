"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface DraftTrip {
  id: string;
  departure_time: string;
  departure_location: string;
  arrival_location: string | null;
  distance_km: number | null;
  toll_fee: number | null;
  trip_type: string | null;
}

const TYPE_COLOR: Record<string, string> = {
  "출퇴근":   "bg-emerald-100 text-emerald-700",
  "개인사용": "bg-orange-100 text-orange-700",
  "업무":     "bg-blue-100 text-blue-700",
};

export default function BulkSubmitSection({ drafts }: { drafts: DraftTrip[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set(drafts.map(d => d.id)));
  const [submittedCount, setSubmittedCount] = useState(0);
  const [done, setDone] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!drafts.length) return null;

  function toggleOne(id: string) {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function toggleAll() {
    if (selected.size === drafts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(drafts.map(d => d.id)));
    }
  }

  function handleSubmit() {
    const ids = [...selected];
    if (!ids.length) return;
    startTransition(async () => {
      let ok = 0;
      for (const id of ids) {
        const res = await fetch(`/api/trips/${id}/submit`, { method: "PATCH" });
        if (res.ok) { ok++; setSubmittedCount(ok); }
      }
      setDone(true);
      setTimeout(() => router.refresh(), 600);
    });
  }

  if (done) {
    return (
      <div className="mx-4 mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-center text-emerald-700 font-medium">
        ✅ {submittedCount}건 제출 완료! 관리자 승인을 기다려주세요.
      </div>
    );
  }

  const allChecked = selected.size === drafts.length;
  const someChecked = selected.size > 0 && selected.size < drafts.length;

  return (
    <div className="mx-4 mt-3 rounded-xl bg-amber-50 border border-amber-200 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-amber-800">
            미제출 기록 {drafts.length}건
          </p>
          <p className="text-xs text-amber-600 mt-0.5">
            {selected.size > 0 ? `${selected.size}건 선택됨` : "선택 없음"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-amber-700 border border-amber-300 rounded-lg px-3 py-1.5 bg-white"
          >
            {expanded ? "접기" : "선택"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || selected.size === 0}
            className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            {isPending
              ? `제출 중(${submittedCount}/${selected.size})...`
              : `제출 (${selected.size}건)`}
          </button>
        </div>
      </div>

      {/* 펼쳐진 선택 목록 */}
      {expanded && (
        <div className="border-t border-amber-200 bg-white">
          {/* 전체 선택 */}
          <label className="flex items-center gap-3 px-4 py-2.5 border-b border-amber-100 cursor-pointer">
            <div
              onClick={toggleAll}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 cursor-pointer
                ${allChecked
                  ? "bg-primary border-primary"
                  : someChecked
                    ? "bg-primary/40 border-primary"
                    : "border-gray-300 bg-white"}`}
            >
              {(allChecked || someChecked) && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  {allChecked
                    ? <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    : <path d="M2 5H8" stroke="white" strokeWidth="2" strokeLinecap="round"/>}
                </svg>
              )}
            </div>
            <span className="text-sm font-medium text-gray-700">전체 선택</span>
            <span className="ml-auto text-xs text-gray-400">{drafts.length}건</span>
          </label>

          {/* 개별 항목 */}
          {drafts.map(trip => {
            const isChecked = selected.has(trip.id);
            const dep = new Date(trip.departure_time);
            const dateStr = dep.toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" });
            const typeKey = trip.trip_type ?? "업무";
            const typeColor = TYPE_COLOR[typeKey] ?? TYPE_COLOR["업무"];

            return (
              <label
                key={trip.id}
                onClick={() => toggleOne(trip.id)}
                className={`flex items-center gap-3 px-4 py-3 border-b border-amber-50 cursor-pointer transition-colors
                  ${isChecked ? "bg-primary/5" : "bg-white"}`}
              >
                {/* 체크박스 */}
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0
                  ${isChecked ? "bg-primary border-primary" : "border-gray-300 bg-white"}`}>
                  {isChecked && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-xs font-medium rounded-full px-1.5 py-0.5 ${typeColor}`}>
                      {typeKey}
                    </span>
                    <span className="text-xs text-gray-400">{dateStr}</span>
                  </div>
                  <p className="text-sm text-gray-800 truncate">
                    {trip.departure_location}
                    <span className="text-gray-400 mx-1">→</span>
                    {trip.arrival_location ?? "—"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {trip.distance_km !== null ? `${trip.distance_km.toLocaleString("ko-KR")}km` : "—"}
                    {trip.toll_fee && trip.toll_fee > 0 ? ` · 통행료 ${trip.toll_fee.toLocaleString("ko-KR")}원` : ""}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
