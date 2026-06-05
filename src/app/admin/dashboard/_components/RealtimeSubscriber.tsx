"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Supabase Realtime 구독 컴포넌트
 * trip_logs 테이블에 변경이 발생하면 대시보드를 자동 갱신합니다.
 * 렌더링 없음 — 사이드 이펙트만 처리
 */
export default function RealtimeSubscriber() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        {
          event:  "*",          // INSERT | UPDATE | DELETE
          schema: "public",
          table:  "trip_logs",
        },
        () => {
          // 변경 감지 시 서버 데이터 재조회 (router.refresh = RSC 재실행)
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
