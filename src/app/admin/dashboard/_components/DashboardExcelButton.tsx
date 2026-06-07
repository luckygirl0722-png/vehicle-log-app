"use client";
import { useState, useTransition } from "react";

interface Props { year: number; month: number; label: string; }

export default function DashboardExcelButton({ year, month, label }: Props) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  async function handleDownload() {
    setMsg(null);
    startTransition(async () => {
      // all_status=true: draft 포함 전체 상태 다운로드
      const res = await fetch(`/api/reports/excel?year=${year}&month=${month}&all_status=true`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMsg(d.error ?? "다운로드 실패");
        setTimeout(() => setMsg(null), 4000);
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename\*=UTF-8\'\'(.+)/i);
      const fn = match ? decodeURIComponent(match[1]) : `차량운행집계_${year}년${String(month).padStart(2,"0")}월.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fn;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      setMsg("다운로드 완료!");
      setTimeout(() => setMsg(null), 3000);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {msg && (
        <span className={`text-xs ${msg.includes("실패") ? "text-destructive" : "text-emerald-600"}`}>
          {msg}
        </span>
      )}
      <button onClick={handleDownload} disabled={isPending}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        {isPending ? "생성 중..." : "Excel 다운로드"}
      </button>
    </div>
  );
}
