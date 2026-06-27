"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Driver {
  id: string;
  employee_no: string;
  name: string;
  department: string;
  phone?: string | null;
  license_no?: string | null;
  email?: string | null;
  user_id?: string | null;
  is_active: boolean;
}
interface DriverModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  driver?: Driver | null;
}

const INITIAL = { employee_no: "", name: "", department: "", phone: "", license_no: "", email: "" };

export default function DriverModal({ open, onOpenChange, driver }: DriverModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isInviting, startInvite] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL);
  // 비밀번호 직접 설정
  const [showPwForm, setShowPwForm] = useState(false);
  const [pw, setPw]               = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwPending, startPw]      = useTransition();
  const [pwMsg, setPwMsg]         = useState<string | null>(null);

  useEffect(() => {
    if (driver) {
      setForm({
        employee_no: driver.employee_no,
        name:        driver.name,
        department:  driver.department,
        phone:       driver.phone ?? "",
        license_no:  driver.license_no ?? "",
        email:       driver.email ?? "",
      });
    } else {
      setForm(INITIAL);
    }
    setError(null);
    setInviteMsg(null);
    setShowPwForm(false);
    setPw(""); setPwConfirm(""); setPwMsg(null);
  }, [driver, open]);

  const isEdit = !!driver;
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const url    = isEdit ? `/api/drivers/${driver!.id}` : "/api/drivers";
      const method = isEdit ? "PATCH" : "POST";
      const payload = { ...form };
      if (!payload.phone)      delete (payload as any).phone;
      if (!payload.license_no) delete (payload as any).license_no;
      if (!payload.email)      delete (payload as any).email;

      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "오류가 발생했습니다."); return; }
      onOpenChange(false);
      router.refresh();
    });
  }

  async function handleInvite() {
    if (!driver?.id || !form.email) {
      setError("이메일을 먼저 입력하고 저장하세요."); return;
    }
    setInviteMsg(null);
    startInvite(async () => {
      const res = await fetch("/api/admin/invite-driver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driver.id, email: form.email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "초대 발송 실패"); return; }
      setInviteMsg(data.message);
      router.refresh();
    });
  }

  async function handleSetPassword() {
    if (!driver?.id || !form.email) { setError("이메일을 먼저 저장하세요."); return; }
    if (!pw) { setError("비밀번호를 입력하세요."); return; }
    if (pw !== pwConfirm) { setError("비밀번호가 일치하지 않습니다."); return; }
    if (pw.length < 6) { setError("비밀번호는 6자 이상이어야 합니다."); return; }
    setError(null); setPwMsg(null);
    startPw(async () => {
      const res = await fetch("/api/admin/set-driver-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driver.id, email: form.email, password: pw }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "비밀번호 설정 실패"); return; }
      setPwMsg(data.message);
      setPw(""); setPwConfirm("");
      setShowPwForm(false);
      router.refresh();
    });
  }

  const fields = [
    { id: "employee_no", label: "사원번호",  placeholder: "EMP001",          required: true  },
    { id: "name",        label: "이름",      placeholder: "홍길동",           required: true  },
    { id: "department",  label: "부서",      placeholder: "영업1팀",          required: true  },
    { id: "email",       label: "이메일(로그인 ID) — 입력 시 계정 자동 생성 (초기 비번: Samwoo2024!)", placeholder: "hong@samwooeleco.com", required: false },
    { id: "phone",       label: "휴대폰",    placeholder: "010-1234-5678",    required: false },
    { id: "license_no",  label: "면허번호",  placeholder: "1종 보통",         required: false },
  ];

  return (
    <Dialog open={open} onOpenChange={v => { setInviteMsg(null); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "운전자 수정" : "운전자 등록"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(({ id, label, placeholder, required }) => (
            <div key={id} className="space-y-1.5">
              <Label htmlFor={id}>
                {label} {required && <span className="text-destructive">*</span>}
                {id === "email" && driver?.user_id && (
                  <span className="ml-2 text-xs text-emerald-600 font-normal">✓ 계정 연결됨</span>
                )}
              </Label>
              <Input
                id={id}
                placeholder={placeholder}
                value={form[id as keyof typeof form]}
                onChange={e => set(id, e.target.value)}
                required={required}
                disabled={isEdit && id === "employee_no"}
                type={id === "email" ? "email" : "text"}
              />
            </div>
          ))}

          {/* 계정 연결 섹션 */}
          {isEdit && form.email && (
            <div className={`rounded-lg p-3 text-sm space-y-3 ${driver?.user_id ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
              {/* 상태 헤더 */}
              <div className="flex items-center justify-between">
                <div>
                  {driver?.user_id ? (
                    <>
                      <p className="font-medium text-emerald-700">✓ 로그인 계정 연결됨</p>
                      <p className="text-xs text-emerald-600 mt-0.5">{form.email}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-amber-700">로그인 계정 미연결</p>
                      <p className="text-xs text-amber-600 mt-0.5">비밀번호를 직접 설정하거나 초대 이메일을 발송하세요</p>
                    </>
                  )}
                </div>
                <Button type="button" size="sm" variant="outline"
                  onClick={() => { setShowPwForm(v => !v); setError(null); }}
                >
                  {showPwForm ? "닫기" : driver?.user_id ? "비번 변경" : "비번 설정"}
                </Button>
              </div>

              {/* 비밀번호 직접 설정 폼 */}
              {showPwForm && (
                <div className="space-y-2 pt-2 border-t border-current/10">
                  <div className="space-y-1">
                    <Label htmlFor="pw" className="text-xs">비밀번호</Label>
                    <Input id="pw" type="password" placeholder="6자 이상" value={pw}
                      onChange={e => setPw(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pw_confirm" className="text-xs">비밀번호 재확인</Label>
                    <Input id="pw_confirm" type="password" placeholder="동일하게 입력" value={pwConfirm}
                      onChange={e => setPwConfirm(e.target.value)}
                      className={pwConfirm && pw !== pwConfirm ? "border-destructive" : ""}
                    />
                    {pwConfirm && pw !== pwConfirm && (
                      <p className="text-xs text-destructive">비밀번호가 일치하지 않습니다</p>
                    )}
                  </div>
                  <Button type="button" size="sm" className="w-full"
                    onClick={handleSetPassword}
                    disabled={pwPending || !pw || pw !== pwConfirm}>
                    {pwPending ? "설정 중..." : driver?.user_id ? "비밀번호 변경" : "계정 생성 + 비밀번호 설정"}
                  </Button>
                </div>
              )}

              {/* 미연결 운전자 — 기본 비번으로 즉시 계정 생성 */}
              {!driver?.user_id && !showPwForm && (
                <div className="space-y-1.5">
                  <Button type="button" size="sm" className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={async () => {
                      if (!driver?.id || !form.email) { setError("이메일을 먼저 입력하고 저장하세요."); return; }
                      setError(null); setPwMsg(null);
                      startPw(async () => {
                        const res = await fetch("/api/admin/set-driver-password", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ driver_id: driver.id, email: form.email, password: "Samwoo2024!" }),
                        });
                        const data = await res.json();
                        if (!res.ok) { setError(data.error ?? "계정 생성 실패"); return; }
                        setPwMsg(`계정 생성 완료! 초기 비번: Samwoo2024!`);
                        router.refresh();
                      });
                    }}
                    disabled={pwPending}>
                    {pwPending ? "생성 중..." : "기본 비번으로 계정 생성 (Samwoo2024!)"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="w-full text-amber-700"
                    onClick={handleInvite} disabled={isInviting}>
                    {isInviting ? "발송 중..." : "초대 이메일 발송 (사용자가 직접 비번 설정)"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {(inviteMsg || pwMsg) && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
              ✅ {inviteMsg ?? pwMsg}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
          )}

          <DialogFooter>
            <DialogClose>
              <Button type="button" variant="outline" disabled={isPending}>취소</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "저장 중..." : isEdit ? "수정 저장" : "등록"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
