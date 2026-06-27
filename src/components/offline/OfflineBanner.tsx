"use client";

import { useEffect, useState } from "react";
import { setupOnlineSync, type SyncResult } from "@/lib/offline/sync";

/**
 * 오프라인 감지 배너
 * - 오프라인: 노란 경고 배너 표시
 * - 온라인 복귀: 자동 동기화 실행 후 결과 알림 (3초 후 사라짐)
 */
export default function OfflineBanner() {
  const [isOffline, setIsOffline]     = useState(false);
  const [syncMsg,   setSyncMsg]       = useState<string | null>(null);

  useEffect(() => {
    // 초기 상태 확인
    setIsOffline(!navigator.onLine);

    const handleOffline = () => { setIsOffline(true); setSyncMsg(null); };
    const handleOnline  = () => { setIsOffline(false); };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online",  handleOnline);

    // 온라인 복귀 시 자동 동기화
    const cleanup = setupOnlineSync((result: SyncResult) => {
      if (result.success > 0) {
        setSyncMsg(`✅ ${result.success}건 동기화 완료`);
        setTimeout(() => setSyncMsg(null), 4000);
      } else if (result.failed > 0) {
        setSyncMsg(`⚠️ ${result.failed}건 동기화 실패 — 나중에 재시도됩니다`);
        setTimeout(() => setSyncMsg(null), 6000);
      }
    });

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online",  handleOnline);
      cleanup();
    };
  }, []);

  // 동기화 완료 메시지
  if (syncMsg) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-emerald-500 text-white
                      text-sm font-medium text-center py-2 px-4 shadow-lg animate-pulse">
        {syncMsg}
      </div>
    );
  }

  // 오프라인 배너
  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white
                    text-sm font-medium text-center py-2 px-4 shadow-lg">
      <span className="mr-2">📵</span>
      오프라인 상태입니다 — 입력 데이터는 자동 저장되며 온라인 복귀 시 동기화됩니다
    </div>
  );
}
