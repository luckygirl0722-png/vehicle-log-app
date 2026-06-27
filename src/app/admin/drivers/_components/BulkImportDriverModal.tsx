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

export interface BulkDriverItem {
  employee_no: string;
  name: string;
  department: string;
  phone: string | null;
  email?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: BulkDriverItem[];
  onSuccess: () => void;
}

interface BulkResult {
  inserted: number;
  updated: number;
  errors: string[];
}

export default function BulkImportDriverModal({
  open,
  onOpenChange,
  items,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<BulkResult | null>(null);

  async function handleImport() {
    startTransition(async () => {
      const res = await fetch("/api/drivers/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items),
      });
      const json = await res.json();
      if (!res.ok) {
        setResult({ inserted: 0, updated: 0, errors: [json.error ?? "오류 발생"] });
      } else {
        setResult(json);
        if ((json.inserted ?? 0) + (json.updated ?? 0) > 0) onSuccess();
      }
    });
  }

  function handleClose() {
    setResult(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>운전자 일괄 등록 / 이메일 업데이트</DialogTitle>
        </DialogHeader>

        {!result ? (
          <>
            <p className="text-sm text-muted-foreground mb-2">
              아래 <strong>{items.length}명</strong>의 운전자를 등록합니다.
              이미 등록된 사원번호는 이메일·부서·휴대폰을 <strong>업데이트</strong>합니다.
            </p>

            <div className="flex-1 overflow-auto rounded-lg border text-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">사원번호</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">이름</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">부서</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">이메일(로그인ID)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((d, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs">{d.employee_no}</td>
                      <td className="px-3 py-2 font-medium">{d.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{d.department}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{d.email ?? "—"}</td>
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
                {isPending ? "처리 중..." : `${items.length}명 일괄 적용`}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex gap-4">
                <div className="flex-1 rounded-lg border p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">{result.inserted}</p>
                  <p className="text-sm text-muted-foreground mt-1">신규 등록</p>
                </div>
                <div className="flex-1 rounded-lg border p-4 text-center">
                  <p className="text-3xl font-bold text-blue-600">{result.updated}</p>
                  <p className="text-sm text-muted-foreground mt-1">이메일 업데이트</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 max-h-40 overflow-auto">
                  <p className="text-xs font-medium text-red-800 mb-1">오류 목록</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-700">{e}</p>
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
