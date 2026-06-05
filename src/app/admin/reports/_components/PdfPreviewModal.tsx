"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PdfPreviewModalProps {
  open:         boolean;
  onOpenChange: (v: boolean) => void;
  year:         number;
  month:        number;
  vehicleId:    string;
  vehicles:     { id: string; plate_number: string }[];
}

export default function PdfPreviewModal({
  open, onOpenChange, year, month, vehicleId, vehicles,
}: PdfPreviewModalProps) {
  const [isPending, startTransition] = useTransition();
  const [pdfUrl, setPdfUrl]   = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  // 모달 열릴 때 PDF 로드
  useEffect(() => {
    if (!open) { setPdfUrl(null); setError(null); return; }

    startTransition(async () => {
      setError(null);
      const params = new URLSearchParams({
        year:  String(year),
        month: String(month),
        ...(vehicleId && { vehicle_id: vehicleId }),
      });

      const res = await fetch(`/api/reports/pdf?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "PDF 생성에 실패했습니다.");
        return;
      }

      const blob = await res.blob();
      // 브라우저 PDF 뷰어에서 열기
      const url  = URL.createObjectURL(blob);
      setPdfUrl(url);
    });

    return () => {
      // 정리
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [open]);

  async function handleDownload() {
    if (!pdfUrl) return;
    const plate = vehicles.find(v => v.id === vehicleId)?.plate_number ?? "전체";
    const monthStr = String(month).padStart(2, "0");
    const a = document.createElement("a");
    a.href     = pdfUrl;
    a.download = `차량운행일지_${year}년${monthStr}월_${plate}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && pdfUrl) URL.revokeObjectURL(pdfUrl); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            PDF 미리보기 — {year}년 {month}월
            {vehicleId && ` · ${vehicles.find(v => v.id === vehicleId)?.plate_number ?? ""}`}
          </DialogTitle>
        </DialogHeader>

        {/* 미리보기 영역 */}
        <div className="flex-1 rounded-lg overflow-hidden border bg-muted">
          {isPending && (
            <div className="h-full flex items-center justify-center space-y-3 flex-col">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">PDF 생성 중...</p>
            </div>
          )}

          {error && !isPending && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-destructive font-medium">❌ {error}</p>
                <p className="text-sm text-muted-foreground">
                  해당 기간에 출력 가능한 기록이 없거나 오류가 발생했습니다
                </p>
              </div>
            </div>
          )}

          {pdfUrl && !isPending && (
            <iframe
              src={`${pdfUrl}#toolbar=1&navpanes=0`}
              className="w-full h-full"
              title="PDF 미리보기"
            />
          )}
        </div>

        <DialogFooter>
          <DialogClose>
            <Button variant="outline">닫기</Button>
          </DialogClose>
          {pdfUrl && (
            <Button onClick={handleDownload} disabled={isPending}>
              📄 PDF 다운로드
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
