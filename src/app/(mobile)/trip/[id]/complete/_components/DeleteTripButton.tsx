"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props { tripId: string; redirectTo?: string; }

export default function DeleteTripButton({ tripId, redirectTo = "/my-trips" }: Props) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    startTransition(async () => {
      const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "삭제에 실패했습니다."); setConfirm(false); return; }
      router.push(redirectTo);
      router.refresh();
    });
  }

  if (!confirm) {
    return (
      <button onClick={() => setConfirm(true)}
        className="w-full rounded-xl border border-destructive/40 text-destructive py-3.5 text-sm font-medium hover:bg-destructive/5 transition-colors">
        🗑 기록 삭제
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-destructive/30 bg-red-50 p-4 space-y-3">
      <p className="text-sm font-semibold text-destructive text-center">이 운행 기록을 삭제할까요?</p>
      <p className="text-xs text-muted-foreground text-center">삭제된 기록은 복구할 수 없습니다.</p>
      {error && <p className="text-xs text-destructive text-center">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => { setConfirm(false); setError(null); }} disabled={isPending}
          className="rounded-xl border border-border bg-background py-3 text-sm font-medium">
          취소
        </button>
        <button onClick={handleDelete} disabled={isPending}
          className="rounded-xl bg-destructive text-white py-3 text-sm font-semibold disabled:opacity-50">
          {isPending ? "삭제 중..." : "삭제 확인"}
        </button>
      </div>
    </div>
  );
}
