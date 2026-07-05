"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface MonthRow {
  year:     number;
  month:    number;
  count:    number;
  isClosed: boolean;
  closedAt: string | null;
}

export default function MonthCloseGrid({ months }: { months: MonthRow[] }) {
  const router  = useRouter();
  const [loading, setLoading] = useState<string | null>(null); // "YYYY-M"
  const [error,   setError]   = useState<string | null>(null);

  async function handleClose(year: number, month: number) {
    const key = `${year}-${month}`;
    setLoading(key);
    setError(null);
    const res = await fetch("/api/admin/monthly-closings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month }),
    });
    setLoading(null);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "마감 실패");
      return;
    }
    router.refresh();
  }

  async function handleReopen(year: number, month: number) {
    const key = `${year}-${month}`;
    setLoading(key);
    setError(null);
    const res = await fetch("/api/admin/monthly-closings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month }),
    });
    setLoading(null);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "마감 해제 실패");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted border-b border-border">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">년월</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">운행 건수</th>
              <th className="px-4 py-3 text-center font-semibold text-muted-foreground">상태</th>
              <th className="px-4 py-3 text-center font-semibold text-muted-foreground">마감일시</th>
              <th className="px-4 py-3 text-center font-semibold text-muted-foreground">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {months.map(m => {
              const key     = `${m.year}-${m.month}`;
              const isLoading = loading === key;
              const label   = `${m.year}년 ${m.month}월`;
              return (
                <tr key={key} className={m.isClosed ? "bg-muted/40" : "bg-background"}>
                  <td className="px-4 py-3 font-medium">{label}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{m.count.toLocaleString("ko-KR")}건</td>
                  <td className="px-4 py-3 text-center">
                    {m.isClosed ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-red-100 text-red-700">
                        🔒 마감됨
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700">
                        🟢 운영중
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                    {m.closedAt
                      ? new Date(m.closedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {m.isClosed ? (
                      <button
                        onClick={() => handleReopen(m.year, m.month)}
                        disabled={isLoading}
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors"
                      >
                        {isLoading ? "처리 중..." : "마감 해제"}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (confirm(`${label}을 마감하시겠습니까?\n마감 후 해당 월 업로드가 차단됩니다.`))
                            handleClose(m.year, m.month);
                        }}
                        disabled={isLoading || m.count === 0}
                        className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors"
                      >
                        {isLoading ? "처리 중..." : "마감"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
