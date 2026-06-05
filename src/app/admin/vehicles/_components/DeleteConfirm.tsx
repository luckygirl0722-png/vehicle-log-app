"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteConfirmProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  id: string;
  name: string;      // 표시 이름 (예: "12가3456")
  endpoint: string;  // 예: /api/vehicles/
}

export default function DeleteConfirm({
  open, onOpenChange, id, name, endpoint,
}: DeleteConfirmProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  async function handleDelete() {
    startTransition(async () => {
      const res  = await fetch(`${endpoint}${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        setResult(`오류: ${data.error}`);
        return;
      }

      // 소프트 삭제 메시지 표시 후 닫기
      if (data._message) {
        setResult(data._message);
        setTimeout(() => { onOpenChange(false); setResult(null); router.refresh(); }, 1500);
      } else {
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>삭제 확인</DialogTitle>
          <DialogDescription>
            <strong>{name}</strong>을(를) 삭제하시겠습니까?
            <br />
            운행 기록이 있는 경우 비활성화 처리됩니다.
          </DialogDescription>
        </DialogHeader>

        {result && (
          <p className="text-sm text-muted-foreground bg-muted rounded px-3 py-2">{result}</p>
        )}

        <DialogFooter>
          <DialogClose>
            <Button variant="outline" disabled={isPending}>취소</Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? "삭제 중..." : "삭제"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
