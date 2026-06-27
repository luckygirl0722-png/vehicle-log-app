"use client";

import { useTransition } from "react";
import { logoutAction } from "@/app/(auth)/login/actions";

interface LogoutButtonProps {
  className?: string;
}

/**
 * 로그아웃 버튼 — Client Component
 * 관리자 사이드바, 모바일 헤더 등에서 공통 사용
 */
export default function LogoutButton({ className }: LogoutButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => logoutAction())}
      disabled={isPending}
      className={className}
    >
      {isPending ? "로그아웃 중..." : "로그아웃"}
    </button>
  );
}
