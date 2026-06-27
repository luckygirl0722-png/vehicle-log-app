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

const INITIAL = { plate_number: "", model: "", purpose: "영업용" as const, note: "" };

export default function VehicleModal({ open, onOpenChange, vehicle }: VehicleModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL);

  // 수정 모드: 폼에 기존 데이터 채우기
  useEffect(() => {
    if (vehicle) {
      setForm({
        plate_number: vehicle.plate_number,
        model:        vehicle.model,
        purpose:      vehicle.purpose,
        note:         vehicle.note ?? "",
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
        body: JSON.stringify(form),
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
