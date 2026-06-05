"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Driver } from "@/types/database";

interface DriverModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  driver?: Driver | null;
}

const INITIAL = { employee_no: "", name: "", department: "", phone: "", license_no: "" };

export default function DriverModal({ open, onOpenChange, driver }: DriverModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL);

  useEffect(() => {
    if (driver) {
      setForm({
        employee_no: driver.employee_no,
        name:        driver.name,
        department:  driver.department,
        phone:       driver.phone ?? "",
        license_no:  driver.license_no ?? "",
      });
    } else {
      setForm(INITIAL);
    }
    setError(null);
  }, [driver, open]);

  const isEdit = !!driver;
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const url    = isEdit ? `/api/drivers/${driver!.id}` : "/api/drivers";
      const method = isEdit ? "PATCH" : "POST";

      const payload = { ...form };
      // 빈 선택 필드 제거
      if (!payload.phone)      delete (payload as Partial<typeof payload>).phone;
      if (!payload.license_no) delete (payload as Partial<typeof payload>).license_no;

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

  const fields: Array<{ id: string; label: string; placeholder: string; required?: boolean; hint?: string }> = [
    { id: "employee_no", label: "사원번호", placeholder: "EMP001", required: true },
    { id: "name",        label: "이름",     placeholder: "홍길동",  required: true },
    { id: "department",  label: "부서",     placeholder: "영업1팀", required: true },
    { id: "phone",       label: "휴대폰",   placeholder: "010-1234-5678", hint: "형식: 010-XXXX-XXXX" },
    { id: "license_no",  label: "면허번호", placeholder: "1종 보통" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "운전자 수정" : "운전자 등록"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(({ id, label, placeholder, required, hint }) => (
            <div key={id} className="space-y-1.5">
              <Label htmlFor={id}>
                {label} {required && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id={id}
                placeholder={placeholder}
                value={form[id as keyof typeof form]}
                onChange={(e) => set(id, e.target.value)}
                required={required}
                disabled={isEdit && id === "employee_no"}
              />
              {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
              {isEdit && id === "employee_no" && (
                <p className="text-xs text-muted-foreground">사원번호는 변경할 수 없습니다.</p>
              )}
            </div>
          ))}

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
