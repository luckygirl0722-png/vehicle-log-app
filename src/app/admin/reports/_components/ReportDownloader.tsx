"use client";

import { useState, useTransition } from "react";

interface Vehicle {
  id:           string;
  plate_number: string;
  model:        string;
}

interface ReportDownloaderProps {
  vehicles: Vehicle[];
}

export default function ReportDownloader({ vehicles }: ReportDownloaderProps) {
  const now      = new Date();
  const [year,   setYear]      = useState(now.getFullYear());
  const [month,  setMonth]     = useState(now.getMonth() + 1);
  const [vehicleId, setVehicleId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [status, setStatus]    = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // 최근 3년치 연도 옵션
  const years  = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  async function handleDownload() {
    setStatus("idle");
    setErrorMsg("");

    startTransition(async () => {
      const params = new URLSearchParams({
        year:  String(year),
        month: String(month),
        ...(vehicleId && { vehicle_id: vehicleId }),
      });

      const res = await fetch(`/api/reports/excel?${params.toString()}`);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setErrorMsg(data.error ?? "다운로드에 실패했습니다.");
        return;
      }

      // Blob → 다운로드 트리거
      const blob        = await res.blob();
      const contentDisp = res.headers.get("Content-Disposition") ?? "";
      // RFC 5987 디코딩
      const match = contentDisp.match(/filename\*=UTF-8''(.+)/i);
      const fileName = match ? decodeURIComponent(match[1]) : `차량운행일지_${year}년${String(month).padStart(2,"0")}월.xlsx`;

      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus("success");
    });
  }

  const selectedPlate = vehicles.find(v => v.id === vehicleId)?.plate_number ?? "전체 차량";

  return (
    <div className="rounded-xl border bg-background p-6 space-y-6 max-w-lg">
      <div>
        <h2 className="text-base font-semibold">Excel 다운로드</h2>
        <p className="text-sm text-muted-foreground mt-1">
          차량운행일지를 국세청 기준 양식으로 다운로드합니다
        </p>
      </div>

      {/* 연도 선택 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">연도</label>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          disabled={isPending}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm
                     focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {years.map(y => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
      </div>

      {/* 월 선택 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">월</label>
        <div className="grid grid-cols-6 gap-1.5">
          {months.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMonth(m)}
              disabled={isPending}
              className={`rounded-md py-2 text-sm font-medium border transition-colors
                ${month === m
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted"}`}
            >
              {m}월
            </button>
          ))}
        </div>
      </div>

      {/* 차량 선택 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">차량 <span className="text-muted-foreground font-normal">(선택)</span></label>
        <select
          value={vehicleId}
          onChange={e => setVehicleId(e.target.value)}
          disabled={isPending}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm
                     focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">전체 차량</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>
              {v.plate_number} · {v.model}
            </option>
          ))}
        </select>
      </div>

      {/* 미리보기 */}
      <div className="rounded-lg bg-muted px-4 py-3 text-sm">
        <p className="text-muted-foreground text-xs mb-1">생성될 파일명</p>
        <p className="font-medium font-mono">
          차량운행일지_{year}년{String(month).padStart(2,"0")}월_{selectedPlate}.xlsx
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Sheet1: 운행 상세 기록 · Sheet2: 차량별 집계
        </p>
      </div>

      {/* 결과 메시지 */}
      {status === "success" && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
          ✅ 다운로드가 시작되었습니다
        </div>
      )}
      {status === "error" && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          ❌ {errorMsg}
        </div>
      )}

      {/* 다운로드 버튼 */}
      <button
        onClick={handleDownload}
        disabled={isPending}
        className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-semibold
                   hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isPending ? "Excel 생성 중..." : "📥  Excel 다운로드"}
      </button>
    </div>
  );
}
