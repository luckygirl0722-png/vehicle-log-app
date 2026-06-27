"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";

interface BulkSubmitButtonProps {
  draftTripIds: string[];  // 완료된 draft 기록 ID 목록
}

/**
 * 이번 달 완료된 draft 기록 전체 제출 버튼
 * 개별 SubmitButton과 달리 여러 건을 한번에 처리
 */
export default function BulkSubmitButton({ draftTripIds }: BulkSubmitButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted]    = useState(0);
  const [done, setDone]              = useState(false);

  if (!draftTripIds.length) return null;

  async function handleBulkSubmit() {
    startTransition(async () => {
      let count = 0;
      // 순차 처리 (병렬 처리 시 서버 부하 고려)
      for (const id of draftTripIds) {
        const res = await fetch(`/api/trips/${id}/submit`, { method: "PATCH" });
        if (res.ok) { count++; setSubmitted(count); }
      }
      setDone(true);
      setTimeout(() => router.refresh(), 800);
    });
  }

  if (done) return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center text-sm text-amber-700 font-medium">
      ✅ {submitted}건이 제출되었습니다. 관리자 승인을 기다려주세요.
    </div>
  );

  return (
    <button
      onClick={handleBulkSubmit}
      disabled={isPending}
      className="w-full rounded-xl bg-primary text-primary-foreground py-3.5 text-sm font-semibold
                 disabled:opacity-50 active:opacity-90 transition-opacity"
    >
      {isPending
        ? `제출 중... (${submitted}/${draftTripIds.length})`
        : `📤  이번 달 기록 ${draftTripIds.length}건 전체 제출`
      }
    </button>
  );
}
