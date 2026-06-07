"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function BulkSubmitSection({ draftIds }: { draftIds: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [count, setCount] = useState(0);

  if (!draftIds.length) return null;

  async function handleSubmitAll() {
    startTransition(async () => {
      let ok = 0;
      for (const id of draftIds) {
        const res = await fetch(`/api/trips/${id}/submit`, { method: "PATCH" });
        if (res.ok) ok++;
        setCount(ok);
      }
      setDone(true);
      setTimeout(() => router.refresh(), 600);
    });
  }

  if (done) return (
    <div className="mx-4 mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-center text-emerald-700 font-medium">
      ✅ {count}건 제출 완료! 관리자 승인을 기다려주세요.
    </div>
  );

  return (
    <div className="mx-4 mt-3 rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-800">미제출 기록 {draftIds.length}건</p>
          <p className="text-xs text-amber-600 mt-0.5">완료된 기록을 일괄 제출합니다</p>
        </div>
        <button onClick={handleSubmitAll} disabled={isPending}
          className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
          {isPending ? `제출 중(${count}/${draftIds.length})...` : "전체 제출"}
        </button>
      </div>
    </div>
  );
}
