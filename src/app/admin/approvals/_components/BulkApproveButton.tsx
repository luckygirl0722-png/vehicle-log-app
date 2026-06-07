"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props { submittedIds: string[]; month: string; }

export default function BulkApproveButton({ submittedIds, month }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  if (!submittedIds.length) return null;

  async function handleApproveAll() {
    setResult(null);
    startTransition(async () => {
      let ok = 0;
      for (const id of submittedIds) {
        const res = await fetch(`/api/trips/${id}/approve`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approved", comment: "월별 일괄 승인" }),
        });
        if (res.ok) ok++;
      }
      setResult(`${ok}건 승인 완료`);
      setConfirm(false);
      setTimeout(() => { router.refresh(); setResult(null); }, 1500);
    });
  }

  if (result) return (
    <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-700 font-medium">
      ✅ {result}
    </div>
  );

  if (confirm) return (
    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
      <p className="text-sm font-medium text-amber-800">{month} 승인 대기 {submittedIds.length}건을 일괄 승인합니다.</p>
      <div className="flex gap-2">
        <button onClick={() => setConfirm(false)}
          className="flex-1 rounded-lg border border-border py-1.5 text-sm">취소</button>
        <button onClick={handleApproveAll} disabled={isPending}
          className="flex-1 rounded-lg bg-primary text-primary-foreground py-1.5 text-sm font-medium disabled:opacity-50">
          {isPending ? "처리 중..." : "승인 확정"}
        </button>
      </div>
    </div>
  );

  return (
    <button onClick={() => setConfirm(true)}
      className="flex items-center gap-2 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 transition-colors">
      ✅ {submittedIds.length}건 일괄 승인
    </button>
  );
}
