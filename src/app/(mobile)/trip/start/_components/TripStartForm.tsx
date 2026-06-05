"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Vehicle, Driver } from "@/types/database";

interface TripStartFormProps {
  vehicles: Pick<Vehicle, "id" | "plate_number" | "model">[];
  driver: Pick<Driver, "id" | "name">;
}

const PURPOSES = [
  "고객사 방문",
  "영업 미팅",
  "부품 납품",
  "자재 수령",
  "현장 점검",
  "사내 출장",
  "기타",
];

export default function TripStartForm({ vehicles, driver }: TripStartFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [customPurpose, setCustomPurpose] = useState(false);

  const [form, setForm] = useState({
    vehicle_id:         vehicles[0]?.id ?? "",
    departure_location: "",
    departure_km:       "",
    purpose:            PURPOSES[0],
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  function handlePurposeSelect(p: string) {
    if (p === "기타") {
      setCustomPurpose(true);
      set("purpose", "");
    } else {
      setCustomPurpose(false);
      set("purpose", p);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const departureKm = parseInt(form.departure_km, 10);
    if (isNaN(departureKm) || departureKm < 0) {
      setError("출발 km는 0 이상의 숫자를 입력하세요.");
      return;
    }
    if (!form.purpose.trim()) {
      setError("업무 목적을 입력하세요.");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id:         form.vehicle_id,
          driver_id:          driver.id,
          departure_location: form.departure_location,
          departure_km:       departureKm,
          purpose:            form.purpose,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "출발 등록에 실패했습니다."); return; }

      router.push(`/trip/${data.id}/end`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* 차량 선택 */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">
          차량 선택 <span className="text-destructive">*</span>
        </label>
        <div className="grid gap-2">
          {vehicles.map(v => (
            <button
              key={v.id}
              type="button"
              onClick={() => set("vehicle_id", v.id)}
              className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-colors
                ${form.vehicle_id === v.id
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-background text-foreground hover:border-primary/40"}`}
            >
              <div>
                <p className="font-medium">{v.plate_number}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{v.model}</p>
              </div>
              {form.vehicle_id === v.id && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 출발지 */}
      <div className="space-y-2">
        <label htmlFor="departure_location" className="text-sm font-semibold text-foreground">
          출발지 <span className="text-destructive">*</span>
        </label>
        <input
          id="departure_location"
          type="text"
          inputMode="text"
          placeholder="삼우에레코 본사"
          value={form.departure_location}
          onChange={e => set("departure_location", e.target.value)}
          required
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base
                     placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* 출발 km */}
      <div className="space-y-2">
        <label htmlFor="departure_km" className="text-sm font-semibold text-foreground">
          출발 계기판 km <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <input
            id="departure_km"
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="45200"
            value={form.departure_km}
            onChange={e => set("departure_km", e.target.value)}
            required
            min="0"
            className="w-full rounded-xl border border-input bg-background px-4 py-3 pr-14 text-base
                       placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">km</span>
        </div>
      </div>

      {/* 업무 목적 */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">
          업무 목적 <span className="text-destructive">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {PURPOSES.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => handlePurposeSelect(p)}
              className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors
                ${(!customPurpose && form.purpose === p) || (p === "기타" && customPurpose)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:border-primary/40"}`}
            >
              {p}
            </button>
          ))}
        </div>
        {customPurpose && (
          <input
            type="text"
            placeholder="업무 목적을 직접 입력하세요"
            value={form.purpose}
            onChange={e => set("purpose", e.target.value)}
            autoFocus
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base
                       placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mt-2"
          />
        )}
      </div>

      {/* 에러 */}
      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* 제출 버튼 */}
      <button
        type="submit"
        disabled={isPending || !form.vehicle_id}
        className="w-full rounded-xl bg-primary text-primary-foreground py-4 text-base font-semibold
                   disabled:opacity-50 active:opacity-90 transition-opacity"
      >
        {isPending ? "출발 등록 중..." : "🚗  운행 시작"}
      </button>
    </form>
  );
}
