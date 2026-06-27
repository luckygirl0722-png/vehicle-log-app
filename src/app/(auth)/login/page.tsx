import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "로그인 — 차량 운행일지",
};

/**
 * 로그인 페이지
 * - 이미 로그인된 사용자는 역할에 따라 자동 리다이렉트 (자동 로그인)
 * - 미인증 사용자에게만 로그인 폼 표시
 */
export default async function LoginPage() {
  // 기존 세션 확인 — 있으면 바로 이동
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleRow?.role === "admin") {
      redirect("/admin/dashboard");
    } else {
      redirect("/");
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* 카드 */}
      <div className="bg-background rounded-2xl shadow-lg border border-border p-8 space-y-6">

        {/* 앱 아이콘 + 헤더 */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto shadow-md">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32" height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v5" />
              <circle cx="16" cy="17" r="2" />
              <circle cx="9" cy="17" r="2" />
              <path d="M5 17H3" />
              <path d="M11 17H7" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">차량 운행일지</h1>
            <p className="text-sm text-muted-foreground mt-1">
              삼우에레코 차량 관리 시스템
            </p>
          </div>
        </div>

        {/* 구분선 */}
        <div className="border-t border-border" />

        {/* 로그인 폼 */}
        <LoginForm />
      </div>

      {/* 하단 안내 */}
      <p className="text-center text-xs text-muted-foreground mt-4">
        계정 문의는 경영지원그룹으로 연락하세요
      </p>
    </div>
  );
}
