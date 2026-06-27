"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  driverId: string;
  driverName: string;
  email: string;
}

export default function ResetPasswordDialog({
  open, onOpenChange, driverId, driverName, email,
}: ResetPasswordDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pw, setPw]           = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setPw(""); setPwConfirm(""); setError(null); setSuccess(null); }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 6) { setError("비밀번호는 6자 이상이어야 합니다."); return; }
    if (pw !== pwConfirm) { setError("비밀번호가 일치하지 않습니다."); return; }

    startTransition(async () => {
      const res = await fetch("/api/admin/set-driver-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driverId, email, password: pw }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "오류가 발생했습니다."); return; }
      setSuccess(data.message);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>비밀번호 초기화</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
          <p className="font-medium">{driverName}</p>
          <p className="text-xs mt-0.5">{email}</p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-3 text-sm text-emerald-700">
              <p className="font-medium">✅ {success}</p>
              <p className="text-xs mt-1 text-emerald-600">
                운전자에게 임시 비밀번호를 전달하고, 로그인 후 프로필에서 변경하도록 안내하세요.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>닫기</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reset_pw">임시 비밀번호</Label>
              <Input
                id="reset_pw"
                type="password"
                placeholder="6자 이상 입력"
                value={pw}
                onChange={e => { setPw(e.target.value); setError(null); }}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reset_pw_confirm">임시 비밀번호 확인</Label>
              <Input
                id="reset_pw_confirm"
                type="password"
                placeholder="동일하게 입력"
                value={pwConfirm}
                onChange={e => { setPwConfirm(e.target.value); setError(null); }}
                autoComplete="new-password"
                className={pwConfirm && pw !== pwConfirm ? "border-destructive" : ""}
              />
              {pwConfirm && pw !== pwConfirm && (
                <p className="text-xs text-destructive">비밀번호가 일치하지 않습니다.</p>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
            )}

            <DialogFooter>
              <Button
                type="button" variant="outline"
                disabled={isPending}
                onClick={() => onOpenChange(false)}
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={isPending || !pw || !pwConfirm || pw !== pwConfirm}
              >
                {isPending ? "초기화 중..." : "비밀번호 초기화"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
