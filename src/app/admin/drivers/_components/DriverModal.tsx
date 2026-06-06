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

  const fields = [
    { id: "employee_no", label: "사원번호",  placeholder: "EMP001",          required: true  },
    { id: "name",        label: "이름",      placeholder: "홍길동",           required: true  },
    { id: "department",  label: "부서",      placeholder: "영업1팀",          required: true  },
    { id: "email",       label: "이메일(로그인 ID)", placeholder: "hong@samwooeleco.com", required: false },
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

          {/* 이메일 있으면 초대 버튼 표시 */}
          {isEdit && form.email && (
            <div className={`rounded-lg p-3 text-sm ${driver?.user_id ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
              {driver?.user_id ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-emerald-700">로그인 계정 연결됨</p>
                    <p className="text-xs text-emerald-600 mt-0.5">{form.email}</p>
                  </div>
                  <Button type="button" size="sm" variant="outline"
                    onClick={handleInvite} disabled={isInviting}>
                    {isInviting ? "발송 중..." : "비번 재설정"}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-amber-700">로그인 계정 미연결</p>
                    <p className="text-xs text-amber-600 mt-0.5">초대 이메일을 발송하세요</p>
                  </div>
                  <Button type="button" size="sm"
                    onClick={handleInvite} disabled={isInviting || !form.email}>
                    {isInviting ? "발송 중..." : "초대 발송"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {inviteMsg && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
              ✅ {inviteMsg}
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
