"use client";

import { useState, useTransition, useEffect } from "react";
import { loginAction } from "@/app/(auth)/login/actions";

export default function LoginForm() {
  const [error, setError]          = useState<string | null>(null);
  const [showPw, setShowPw]        = useState(false);
  const [remember, setRemember]    = useState(false);
  const [savedEmail, setSavedEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  // 저장된 이메일 불러오기
  useEffect(() => {
    const stored = localStorage.getItem("remembered_email");
    if (stored) { setSavedEmail(stored); setRemember(true); }
  }, []);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const email = formData.get("email") as string;
    if (remember) {
      localStorage.setItem("remembered_email", email);
    } else {
      localStorage.removeItem("remembered_email");
    }
    startTransition(async () => {
      const result = await loginAction(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {/* 이메일 */}
      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium text-foreground">이메일</label>
        <input
          id="email" name="email" type="email" autoComplete="email"
          required placeholder="example@samwooeleco.com"
          defaultValue={savedEmail}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                     placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring
                     disabled:opacity-50"
          disabled={isPending}
        />
      </div>

      {/* 비밀번호 + 눈 아이콘 */}
      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium text-foreground">비밀번호</label>
        <div className="relative">
          <input
            id="password" name="password"
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            required placeholder="••••••••"
            className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm
                       placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring
                       disabled:opacity-50"
            disabled={isPending}
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
            aria-label={showPw ? "비밀번호 숨기기" : "비밀번호 보기"}
          >
            {showPw ? (
              /* 눈 열림 (보임) */
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            ) : (
              /* 눈 닫힘 (숨김) */
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 이메일 기억 체크박스 */}
      <div className="flex items-center gap-2">
        <input
          id="remember" type="checkbox" checked={remember}
          onChange={e => setRemember(e.target.checked)}
          className="w-4 h-4 rounded border-input accent-primary cursor-pointer"
        />
        <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer select-none">
          이메일 기억하기
        </label>
      </div>

      {/* 에러 */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* 제출 버튼 */}
      <button
        type="submit" disabled={isPending}
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground
                   hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? "로그인 중..." : "로그인"}
      </button>
    </form>
  );
}
