"use client";
import { useState, useTransition } from "react";

interface VehicleStat {
  vehicle_id:   string;
  plate_number: string;
  model:        string;
  bizKm:   number; bizToll:   number;
  comKm:   number; comToll:   number;
  perKm:   number; perToll:   number;
  totalKm: number;
  tripCount: number;
}

interface DriverStat {
  driver_id:   string;
  driver_name: string;
  bizKm:   number; bizToll:   number;
  comKm:   number; comToll:   number;
  perKm:   number; perToll:   number;
  totalKm: number;
  tripCount: number;
  vehicles: VehicleStat[];
}

interface Props { rows: DriverStat[]; year: number; month: number; }

const fmt = (n: number) => n.toLocaleString("ko-KR");

export default function DriverMonthlyStats({ rows, year, month }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [xlsxMsg, setXlsxMsg] = useState<string | null>(null);

  function handleExcelDownload() {
    setXlsxMsg(null);
    startTransition(async () => {
      const res = await fetch(`/api/reports/excel/driver-summary?year=${year}&month=${month}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setXlsxMsg(d.error ?? "다운로드 실패");
        setTimeout(() => setXlsxMsg(null), 4000);
        return;
      }
      const blob = await res.blob();
      const cd   = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename\*=UTF-8''(.+)/i);
      const fn   = match ? decodeURIComponent(match[1]) : `운전자별운행집계_${year}년${String(month).padStart(2,"0")}월.xlsx`;
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = fn;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      setXlsxMsg("다운로드 완료!");
      setTimeout(() => setXlsxMsg(null), 3000);
    });
  }

  if (!rows.length) {
    return <div className="text-center text-sm text-muted-foreground py-8">이번 달 운행 기록이 없습니다</div>;
  }

  function toggle(id: string) {
    setExpanded(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  const totBizKm   = rows.reduce((s, r) => s + r.bizKm,   0);
  const totBizToll = rows.reduce((s, r) => s + r.bizToll, 0);
  const totComKm   = rows.reduce((s, r) => s + r.comKm,   0);
  const totComToll = rows.reduce((s, r) => s + r.comToll, 0);
  const totPerKm   = rows.reduce((s, r) => s + r.perKm,   0);
  const totPerToll = rows.reduce((s, r) => s + r.perToll, 0);
  const totKm      = rows.reduce((s, r) => s + r.totalKm, 0);

  return (
    <div className="space-y-3">
      {/* Excel 다운로드 버튼 */}
      <div className="flex items-center justify-end gap-2">
        {xlsxMsg && (
          <span className={`text-xs ${xlsxMsg.includes("실패") ? "text-destructive" : "text-emerald-600"}`}>
            {xlsxMsg}
          </span>
        )}
        <button onClick={handleExcelDownload} disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {isPending ? "생성 중..." : "Excel 다운로드"}
        </button>
      </div>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-8" />
            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">운전자</th>
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">업무 km</th>
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">업무 통행료</th>
            <th className="px-3 py-2.5 text-right font-medium text-emerald-600">출퇴근 km</th>
            <th className="px-3 py-2.5 text-right font-medium text-emerald-600">통행료(출퇴근)</th>
            <th className="px-3 py-2.5 text-right font-medium text-orange-600">개인 km</th>
            <th className="px-3 py-2.5 text-right font-medium text-orange-600">통행료(개인)</th>
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">건수</th>
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">합계 km</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(driver => {
            const isOpen = expanded.has(driver.driver_id);
            const multiVehicle = driver.vehicles.length > 1;
            return (
              <>
                {/* 운전자 행 */}
                <tr
                  key={driver.driver_id}
                  onClick={() => toggle(driver.driver_id)}
                  className={`border-b transition-colors ${multiVehicle ? "cursor-pointer hover:bg-muted/40" : "hover:bg-muted/20"}`}
                >
                  <td className="px-3 py-3 text-center text-muted-foreground">
                    {multiVehicle && (
                      <span className="text-xs">{isOpen ? "▼" : "▶"}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {driver.driver_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold">{driver.driver_name}</p>
                        {multiVehicle && (
                          <p className="text-xs text-muted-foreground">{driver.vehicles.length}개 차량</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-medium">
                    {driver.bizKm > 0 ? `${fmt(driver.bizKm)} km` : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {driver.bizToll > 0 ? `${fmt(driver.bizToll)}원` : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-emerald-700">
                    {driver.comKm > 0 ? `${fmt(driver.comKm)} km` : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right text-emerald-700">
                    {driver.comToll > 0 ? `${fmt(driver.comToll)}원` : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-orange-700">
                    {driver.perKm > 0 ? `${fmt(driver.perKm)} km` : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right text-orange-700">
                    {driver.perToll > 0 ? `${fmt(driver.perToll)}원` : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right text-muted-foreground">{driver.tripCount}건</td>
                  <td className="px-3 py-3 text-right font-bold">{fmt(driver.totalKm)} km</td>
                </tr>

                {/* 차량별 세부 행 (펼쳐진 경우) */}
                {isOpen && driver.vehicles.map(v => (
                  <tr key={`${driver.driver_id}-${v.vehicle_id}`}
                    className="border-b bg-muted/20 text-xs">
                    <td />
                    <td className="px-3 py-2 pl-10">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="text-base">🚗</span>
                        <div>
                          <span className="font-medium text-foreground">{v.plate_number}</span>
                          <span className="ml-1 text-muted-foreground">{v.model}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {v.bizKm > 0 ? `${fmt(v.bizKm)} km` : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {v.bizToll > 0 ? `${fmt(v.bizToll)}원` : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-600">
                      {v.comKm > 0 ? `${fmt(v.comKm)} km` : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-600">
                      {v.comToll > 0 ? `${fmt(v.comToll)}원` : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-orange-500">
                      {v.perKm > 0 ? `${fmt(v.perKm)} km` : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-orange-500">
                      {v.perToll > 0 ? `${fmt(v.perToll)}원` : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{v.tripCount}건</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmt(v.totalKm)} km</td>
                  </tr>
                ))}
              </>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/30">
            <td />
            <td className="px-3 py-2.5 font-semibold text-sm">합계</td>
            <td className="px-3 py-2.5 text-right font-semibold text-sm">{fmt(totBizKm)} km</td>
            <td className="px-3 py-2.5 text-right font-semibold text-sm">{fmt(totBizToll)}원</td>
            <td className="px-3 py-2.5 text-right font-semibold text-sm text-emerald-700">{fmt(totComKm)} km</td>
            <td className="px-3 py-2.5 text-right font-semibold text-sm text-emerald-700">{fmt(totComToll)}원</td>
            <td className="px-3 py-2.5 text-right font-semibold text-sm text-orange-700">{fmt(totPerKm)} km</td>
            <td className="px-3 py-2.5 text-right font-semibold text-sm text-orange-700">{fmt(totPerToll)}원</td>
            <td className="px-3 py-2.5 text-right font-semibold text-sm text-muted-foreground">{rows.reduce((s,r)=>s+r.tripCount,0)}건</td>
            <td className="px-3 py-2.5 text-right font-bold text-sm">{fmt(totKm)} km</td>
          </tr>
        </tfoot>
      </table>
    </div>
    </div>
  );
}
