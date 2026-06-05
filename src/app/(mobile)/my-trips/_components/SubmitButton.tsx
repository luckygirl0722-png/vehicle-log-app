"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";

interface SubmitButtonProps {
  tripId: string;
}

/**
 * 운행 기록 제출 버튼 — draft → submitted 상태 전환
 */
export default function SubmitButton({ tripId }: SubmitButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    startTransition(async () => {
      const res  = await fetch(`/api/trips/${tripId}/submit`, { method: "PATCH" });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.refresh(), 600);
      }
    });
  }

  if (done) return (
    <span className="text-xs text-amber-600 font-medium px-3 py-1.5 bg-amber-50 rounded-full">
      제출됨 ✓
    </span>
  );

  return (
    <button
      onClick={e => { e.preventDefault(); handleSubmit(); }}
      disabled={isPending}
      className="text-xs font-medium px-3 py-1.5 rounded-full bg-primary text-primary-foreground
                 disabled:opacity-50 active:opacity-80 transition-opacity"
    >
      {isPending ? "제출 중..." : "제출"}
    </button>
  );
}
