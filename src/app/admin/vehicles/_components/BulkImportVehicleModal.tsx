"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** 엑셀에서 가져온 차량 데이터 (사전 파싱된 상태) */
export interface BulkVehicleItem {
  plate_number: string;
  model: string;
  purpose: "영업용" | "업무용";
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: BulkVehicleItem[];
  onSuccess: () => void;
}

interface BulkResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

export default function BulkImportVehicleModal({
  open,
  onOpenChange,
  items,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<BulkResult | null>(null);

  async function handleImport() {
    startTransition(async () => {
      const res = await fetch("/api/vehicles/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items),
      });
      const json = await res.json();
      if (!res.ok) {
        setResult({ inserted: 0, skipped: 0, errors: [json.error ?? "오류 발생"] });
      } else {
        setResult(json);
        if (json.inserted > 0) onSuccess();
      }
    });
  }

  function handleClose() {
    setResult(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>차량 일괄 등록</DialogTitle>
        </DialogHeader>

        {!result ? (
          <>
            <p className="text-sm text-muted-foreground mb-2">
              아래 <strong>{items.length}대</strong>의 차량을 등록합니다.
              이미 등록된 차량번호는 자동으로 건너뜁니다.
            </p>

            {/* 미리보기 테이블 */}
            <div className="flex-1 overflow-auto rounded-lg border text-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">차량번호</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">차종</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">용도</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((v, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{v.plate_number}</td>
                      <td className="px-3 py-2">{v.model}</td>
                      <td className="px-3 py-2">
                        <Badge variant="default">{v.purpose}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={handleClose} disabled={isPending}>
                취소
              </Button>
              <Button onClick={handleImport} disabled={isPending}>
                {isPending ? "등록 중..." : `${items.length}대 일괄 등록`}
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* 결과 화면 */
          <>
            <div className="space-y-3">
              <div className="flex gap-4">
                <div className="flex-1 rounded-lg border p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">{result.inserted}</p>
                  <p className="text-sm text-muted-foreground mt-1">등록 성공</p>
                </div>
                <div className="flex-1 rounded-lg border p-4 text-center">
                  <p className="text-3xl font-bold text-yellow-500">{result.skipped}</p>
                  <p className="text-sm text-muted-foreground mt-1">중복 건너뜀</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 max-h-40 overflow-auto">
                  <p className="text-xs font-medium text-yellow-800 mb-1">건너뜀 / 오류 목록</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-yellow-700">{e}</p>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="mt-4">
              <Button onClick={handleClose}>닫기</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
