"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Vehicle } from "@/types/database";

interface VehicleModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vehicle?: Vehicle | null; // null = 신규 등록, Vehicle = 수정
}

type Ownership = "자가" | "렌트" | "리스";
type Status    = "운행중" | "매각" | "반납" | "폐차";

const INITIAL = {
  plate_number: "", model: "", purpose: "영업용" as "영업용" | "업무용", note: "",
  ownership_type: "자가" as Ownership,
  status:         "운행중" as Status,
  rental_company: "",
  contract_start: "",
  contract_end:   "",
  disposed_date:  "",
};

export default function VehicleModal({ open, onOpenChange, vehicle }: VehicleModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL);

  // 수정 모드: 폼에 기존 데이터 채우기
  useEffect(() => {
    if (vehicle) {
      setForm({
        plate_number:   vehicle.plate_number,
        model:          vehicle.model,
        purpose:        vehicle.purpose,
        note:           vehicle.note ?? "",
        ownership_type: vehicle.ownership_type ?? "자가",
        status:         vehicle.status ?? (vehicle.is_active ? "운행중" : "매각"),
        rental_company: vehicle.rental_company ?? "",
        contract_start: vehicle.contract_start ?? "",
        contract_end:   vehicle.contract_end ?? "",
        disposed_date:  vehicle.disposed_date ?? "",
      });
    } else {
      setForm(INITIAL);
    }
    setError(null);
  }, [vehicle, open]);

  const isEdit = !!vehicle;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const url    = isEdit ? `/api/vehicles/${vehicle!.id}` : "/api/vehicles";
      const method = isEdit ? "PATCH" : "POST";

      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          rental_company: form.ownership_type === "자가" ? null : (form.rental_company || null),
          contract_end:   form.ownership_type === "자가" ? null : form.contract_end,
          disposed_date:  form.status === "운행중" ? null : form.disposed_date,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "오류가 발생했습니다.");
        return;
      }

      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "차량 수정" : "차량 등록"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 차량번호 */}
          <div className="space-y-1.5">
            <Label htmlFor="plate_number">차량번호 <span className="text-destructive">*</span></Label>
            <Input
              id="plate_number"
              placeholder="12가3456"
              value={form.plate_number}
              onChange={(e) => setForm({ ...form, plate_number: e.target.value })}
              disabled={isEdit} // 차량번호는 수정 불가
              required
            />
            {isEdit && (
              <p className="text-xs text-muted-foreground">차량번호는 변경할 수 없습니다.</p>
            )}
          </div>

          {/* 차종 */}
          <div className="space-y-1.5">
            <Label htmlFor="model">차종 <span className="text-destructive">*</span></Label>
            <Input
              id="model"
              placeholder="현대 아반떼"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              required
            />
          </div>

          {/* 용도 */}
          <div className="space-y-1.5">
            <Label htmlFor="purpose">용도 <span className="text-destructive">*</span></Label>
            <Select
              id="purpose"
              value={form.purpose}
              onChange={(e) =>
                setForm({ ...form, purpose: e.target.value as "영업용" | "업무용" })
              }
            >
              <option value="영업용">영업용</option>
              <option value="업무용">업무용</option>
            </Select>
          </div>

          {/* 소유구분 / 렌트·리스 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ownership_type">소유구분</Label>
              <Select
                id="ownership_type"
                value={form.ownership_type}
                onChange={(e) => setForm({ ...form, ownership_type: e.target.value as Ownership })}
              >
                <option value="자가">자가 (회사 소유)</option>
                <option value="렌트">렌트</option>
                <option value="리스">리스</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contract_start">
                {form.ownership_type === "자가" ? "취득일" : "계약 시작일"}
              </Label>
              <Input id="contract_start" type="date" value={form.contract_start}
                onChange={(e) => setForm({ ...form, contract_start: e.target.value })} />
            </div>
          </div>
          {form.ownership_type !== "자가" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rental_company">{form.ownership_type}사</Label>
                <Input id="rental_company" placeholder="예: 롯데렌탈"
                  value={form.rental_company}
                  onChange={(e) => setForm({ ...form, rental_company: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contract_end">계약 만료일</Label>
                <Input id="contract_end" type="date" value={form.contract_end}
                  onChange={(e) => setForm({ ...form, contract_end: e.target.value })} />
              </div>
            </div>
          )}

          {/* 상태 (매각·반납·폐차) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="status">상태</Label>
              <Select
                id="status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Status })}
              >
                <option value="운행중">운행중</option>
                <option value="매각">매각</option>
                <option value="반납">반납 (렌트·리스 종료)</option>
                <option value="폐차">폐차</option>
              </Select>
            </div>
            {form.status !== "운행중" && (
              <div className="space-y-1.5">
                <Label htmlFor="disposed_date">{form.status}일 <span className="text-destructive">*</span></Label>
                <Input id="disposed_date" type="date" value={form.disposed_date} required
                  onChange={(e) => setForm({ ...form, disposed_date: e.target.value })} />
              </div>
            )}
          </div>
          {form.status !== "운행중" && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">
              {form.status} 처리하면 운전자 앱에서 이 차량이 숨겨지고 사용자 이력이 종료됩니다.
              과거 운행기록과 운행기록부는 그대로 보존·조회됩니다.
            </p>
          )}

          {/* 비고 */}
          <div className="space-y-1.5">
            <Label htmlFor="note">비고</Label>
            <Input
              id="note"
              placeholder="영업팀 1호차"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>

          {/* 에러 */}
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
