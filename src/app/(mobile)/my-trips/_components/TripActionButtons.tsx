"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props { tripId: string; }

export default function TripActionButtons({ tripId }: Props) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [isPending, start] = useTransition();

  async function handleDelete() {
    start(async () => {
      const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
      if (res.ok) router.refresh();
      else setConfirm(false);
    });
  }

  return (
    <div className="flex gap-2 pt-1">
      <Link href={`/trip/${tripId}/end?edit=1`}
        className="flex-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 py-2 text-xs font-semibold text-center hover:bg-amber-100 transition-colors">
        ✏️ 수정
      </Link>
      {!confirm ? (
        <button onClick={() => setConfirm(true)}
          className="flex-1 rounded-lg border border-red-200 bg-red-50 text-red-600 py-2 text-xs font-semibold hover:bg-red-100 transition-colors">
          🗑 삭제
        </button>
      ) : (
        <div className="flex-1 flex gap-1">
          <button onClick={() => setConfirm(false)} disabled={isPending}
            className="flex-1 rounded-lg border border-border bg-background py-2 text-xs font-medium">
            취소
          </button>
          <button onClick={handleDelete} disabled={isPending}
            className="flex-1 rounded-lg bg-destructive text-white py-2 text-xs font-bold disabled:opacity-50">
            {isPending ? "..." : "확인"}
          </button>
        </div>
      )}
    </div>
  );
}
