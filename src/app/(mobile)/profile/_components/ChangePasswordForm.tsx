"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";

interface Props {
  isForced?: boolean;
}

export default function ChangePasswordForm({ isForced = false }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pw, setPw]               = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (pw.length < 6) { setError("비밀번호는 6자 이상이어야 합니다."); return; }
    if (pw !== pwConfirm) { setError("비밀번호가 일치하지 않습니다."); return; }

    startTransition(async () => {
      const res = await fetch("/api/auth/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "오류가 발생했습니다.");
        return;
      }

      setSuccess(data.message);
      setPw("");
      setPwConfirm("");

      if (isForced) {
        setTimeout(() => router.replace("/"), 1200);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="pw">새 비밀번호</Label>
        <div className="relative">
          <Input
            id="pw"
            type={showPw ? "text" : "password"}
            placeholder="6자 이상 입력"
            value={pw}
            onChange={e => { setPw(e.target.value); setError(null); setSuccess(null); }}
            autoComplete="new-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pw_confirm">새 비밀번호 확인</Label>
        <div className="relative">
          <Input
            id="pw_confirm"
            type={showConfirm ? "text" : "password"}
            placeholder="동일하게 입력"
            value={pwConfirm}
            onChange={e => { setPwConfirm(e.target.value); setError(null); setSuccess(null); }}
            autoComplete="new-password"
            className={`pr-10 ${pwConfirm && pw !== pwConfirm ? "border-destructive" : ""}`}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {pwConfirm && pw !== pwConfirm && (
          <p className="text-xs text-destructive">비밀번호가 일치하지 않습니다.</p>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
          ✅ {success}{isForced && " 잠시 후 이동합니다..."}
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={isPending || !pw || !pwConfirm}
      >
        {isPending ? "변경 중..." : isForced ? "비밀번호 변경 후 시작하기" : "비밀번호 변경"}
      </Button>
    </form>
  );
}
