"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/app/(auth)/login/actions";

/**
 * 로그인 폼 — Client Component
 * Server Action 호출, 에러 상태 표시
 */
export default function LoginForm() {
  const [error, setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await loginAction(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {/* 이메일 */}
      <div className="space-y-1">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-foreground"
        >
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="example@company.com"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                     placeholder:text-muted-foreground
                     focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
                     disabled:opacity-50"
          disabled={isPending}
        />
      </div>

      {/* 비밀번호 */}
      <div className="space-y-1">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-foreground"
        >
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                     placeholder:text-muted-foreground
                     focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
                     disabled:opacity-50"
          disabled={isPending}
        />
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* 제출 버튼 */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground
                   hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
      >
        {isPending ? "로그인 중..." : "로그인"}
      </button>
    </form>
  );
}
