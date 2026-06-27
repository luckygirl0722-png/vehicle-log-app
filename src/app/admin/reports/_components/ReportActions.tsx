"use client";

import { useState, useTransition } from "react";
import PdfPreviewModal from "./PdfPreviewModal";

interface Vehicle {
  id:           string;
  plate_number: string;
  model:        string;
}

interface ReportActionsProps {
  vehicles: Vehicle[];
}

/**
 * Excel + PDF 통합 다운로드 컴포넌트
 * ReportDownloader (Excel) + PdfPreviewModal (PDF) 를 하나의 폼에서 제어
 */
export default function ReportActions({ vehicles }: ReportActionsProps) {
  const now   = new Date();
  const [year,      setYear]      = useState(now.getFullYear());
  const [month,     setMonth]     = useState(now.getMonth() + 1);
  const [vehicleId, setVehicleId] = useState("");

  // Excel 상태
  const [xlsPending, startXls] = useTransition();
  const [xlsStatus, setXlsStatus] = useState<"idle"|"success"|"error">("idle");
  const [xlsError,  setXlsError]  = useState("");

  // PDF 모달
  const [pdfOpen, setPdfOpen] = useState(false);

  const years  = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const selectedPlate = vehicles.find(v => v.id === vehicleId)?.plate_number ?? "전체 차량";

  async function handleExcelDownload() {
    setXlsStatus("idle"); setXlsError("");
    startXls(async () => {
      const params = new URLSearchParams({
        year: String(year), month: String(month),
        ...(vehicleId && { vehicle_id: vehicleId }),
      });
      const res  = await fetch(`/api/reports/excel?${params.toString()}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setXlsStatus("error"); setXlsError(d.error ?? "다운로드 실패"); return;
      }
      const blob = await res.blob();
      const cd   = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename\*=UTF-8''(.+)/i);
      const fn   = match ? decodeURIComponent(match[1]) : `차량운행일지_${year}년${String(month).padStart(2,"0")}월.xlsx`;
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a"); a.href = url; a.download = fn;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setXlsStatus("success");
    });
  }

  return (
    <>
      <div className="rounded-xl border bg-background p-6 space-y-6 max-w-lg">
        <div>
          <h2 className="text-base font-semibold">보고서 다운로드</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Excel 또는 PDF 형식으로 차량운행일지를 생성합니다
          </p>
        </div>

        {/* 연도 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">연도</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            {years.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
        </div>

        {/* 월 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">월</label>
          <div className="grid grid-cols-6 gap-1.5">
            {months.map(m => (
              <button key={m} type="button" onClick={() => setMonth(m)}
                className={`rounded-md py-2 text-sm font-medium border transition-colors
                  ${month === m ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}>
                {m}월
              </button>
            ))}
          </div>
        </div>

        {/* 차량 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">차량 <span className="text-muted-foreground font-normal text-xs">(선택)</span></label>
          <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="">전체 차량</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.plate_number} · {v.model}</option>
            ))}
          </select>
        </div>

        {/* 파일명 미리보기 */}
        <div className="rounded-lg bg-muted px-4 py-3 text-sm">
          <p className="text-xs text-muted-foreground mb-1">생성될 파일명</p>
          <p className="font-medium font-mono text-xs">
            차량운행일지_{year}년{String(month).padStart(2,"0")}월_{selectedPlate}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">
            Sheet1: 운행 상세 기록 · Sheet2: 차량별 집계 (Excel)
          </p>
        </div>

        {/* 상태 메시지 */}
        {xlsStatus === "success" && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
            ✅ Excel 다운로드가 시작되었습니다
          </div>
        )}
        {xlsStatus === "error" && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            ❌ {xlsError}
          </div>
        )}

        {/* 버튼 영역 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleExcelDownload}
            disabled={xlsPending}
            className="rounded-lg border border-primary text-primary py-2.5 text-sm font-semibold
                       hover:bg-primary/5 disabled:opacity-50 transition-colors"
          >
            {xlsPending ? "생성 중..." : "📥 Excel 다운로드"}
          </button>
          <button
            onClick={() => { setXlsStatus("idle"); setPdfOpen(true); }}
            className="rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-semibold
                       hover:bg-primary/90 transition-colors"
          >
            📄 PDF 미리보기
          </button>
        </div>
      </div>

      <PdfPreviewModal
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        year={year}
        month={month}
        vehicleId={vehicleId}
        vehicles={vehicles}
      />
    </>
  );
}
