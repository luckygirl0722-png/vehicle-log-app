"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Vehicle { id: string; plate_number: string; model: string; }
interface Driver  { id: string; name: string; }
interface Props   {
  vehicles:  Vehicle[];
  driver:    Driver;
  lastKmMap: Record<string, number>; // vehicleId -> 마지막 도착km
}

const BUSINESS_PURPOSES = ["고객사 방문","영업 미팅","부품 납품","자재 수령","현장 점검","사내 출장","기타"];
const COMMUTE_PURPOSES  = ["출근","퇴근","기타"];

function toLocalDateTimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TripStartForm({ vehicles, driver, lastKmMap }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tripType, setTripType] = useState<"업무" | "출퇴근">("업무");
  const [customPurpose, setCustomPurpose] = useState(false);
  const now = new Date();

  const [form, setForm] = useState({
    vehicle_id:         vehicles[0]?.id ?? "",
    departure_location: "",
    departure_km:       lastKmMap[vehicles[0]?.id ?? ""] ? String(lastKmMap[vehicles[0]?.id ?? ""]) : "",
    purpose:            BUSINESS_PURPOSES[0],
    departure_time:     toLocalDateTimeString(now),
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // 차량 변경 시 마지막 km 자동 입력
  function handleVehicleSelect(vehicleId: string) {
    const lastKm = lastKmMap[vehicleId];
    setForm(f => ({
      ...f,
      vehicle_id:   vehicleId,
      departure_km: lastKm !== undefined ? String(lastKm) : "",
    }));
  }

  // 운행 유형 변경 시 목적 초기화
  function handleTypeChange(type: "업무" | "출퇴근") {
    setTripType(type);
    setCustomPurpose(false);
    setForm(f => ({
      ...f,
      purpose: type === "업무" ? BUSINESS_PURPOSES[0] : COMMUTE_PURPOSES[0],
    }));
  }

  const purposes = tripType === "업무" ? BUSINESS_PURPOSES : COMMUTE_PURPOSES;

  function handlePurposeSelect(p: string) {
    if (p === "기타") { setCustomPurpose(true); set("purpose", ""); }
    else { setCustomPurpose(false); set("purpose", p); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const depKm = parseInt(form.departure_km, 10);
    if (isNaN(depKm) || depKm < 0) { setError("출발 km를 입력하세요."); return; }
    if (!form.purpose.trim()) { setError("업무 목적을 입력하세요."); return; }

    startTransition(async () => {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id:         form.vehicle_id,
          driver_id:          driver.id,
          departure_location: form.departure_location,
          departure_km:       depKm,
          purpose:            tripType === "출퇴근" ? `[출퇴근] ${form.purpose}` : form.purpose,
          departure_time:     new Date(form.departure_time).toISOString(),
          trip_type:          tripType,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "출발 등록 실패"); return; }
      router.push(`/trip/${data.id}/end`);
      router.refresh();
    });
  }

  const lastKm = lastKmMap[form.vehicle_id];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* 운행 유형 토글 */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">운행 유형 <span className="text-destructive">*</span></label>
        <div className="grid grid-cols-2 gap-2">
          {(["업무", "출퇴근"] as const).map(type => (
            <button key={type} type="button" onClick={() => handleTypeChange(type)}
              className={`rounded-xl py-3 text-sm font-semibold border-2 transition-colors
                ${tripType === type
                  ? type === "업무"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-emerald-600 text-white border-emerald-600"
                  : "bg-background border-border text-foreground"}`}>
              {type === "업무" ? "🚗 업무" : "🏠 출퇴근"}
            </button>
          ))}
        </div>
        {tripType === "출퇴근" && (
          <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
            출퇴근 운행 — km와 통행료가 별도 집계됩니다
          </p>
        )}
      </div>

      {/* 날짜/시간 */}
      <div className="space-y-2">
        <label htmlFor="dep_time" className="text-sm font-semibold">
          출발 일시 <span className="text-destructive">*</span>
        </label>
        <input id="dep_time" type="datetime-local" value={form.departure_time}
          onChange={e => set("departure_time", e.target.value)} required
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50" />
        <p className="text-xs text-muted-foreground">
          {form.departure_time && (() => {
            const d = new Date(form.departure_time);
            return d.toLocaleDateString("ko-KR", { year:"numeric", month:"long", day:"numeric", weekday:"long" });
          })()}
        </p>
      </div>

      {/* 차량 선택 */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">차량 선택 <span className="text-destructive">*</span></label>
        <div className="grid gap-2">
          {vehicles.map(v => (
            <button key={v.id} type="button" onClick={() => handleVehicleSelect(v.id)}
              className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-colors
                ${form.vehicle_id === v.id ? "border-primary bg-primary/5 text-primary" : "border-border bg-background"}`}>
              <div>
                <p className="font-medium">{v.plate_number}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{v.model}</p>
              </div>
              <div className="text-right">
                {lastKmMap[v.id] !== undefined && (
                  <p className="text-xs text-muted-foreground">마지막 {lastKmMap[v.id].toLocaleString("ko-KR")} km</p>
                )}
                {form.vehicle_id === v.id && <span className="text-primary font-bold text-sm">✓</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 출발지 */}
      <div className="space-y-2">
        <label htmlFor="dep_loc" className="text-sm font-semibold">
          출발지 <span className="text-destructive">*</span>
        </label>
        <input id="dep_loc" type="text" inputMode="text"
          placeholder={tripType === "출퇴근" ? "자택" : "삼우에레코 본사"}
          value={form.departure_location} onChange={e => set("departure_location", e.target.value)} required
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>

      {/* 출발 km */}
      <div className="space-y-2">
        <label htmlFor="dep_km" className="text-sm font-semibold">
          출발 계기판 km <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <input id="dep_km" type="number" inputMode="numeric"
            placeholder={lastKm !== undefined ? `마지막 ${lastKm.toLocaleString("ko-KR")}` : "45200"}
            value={form.departure_km} onChange={e => set("departure_km", e.target.value)} required min="0"
            className="w-full rounded-xl border border-input bg-background px-4 py-3 pr-14 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">km</span>
        </div>
        {lastKm !== undefined && (
          <p className="text-xs text-primary">
            이전 도착: {lastKm.toLocaleString("ko-KR")} km
            {form.departure_km === String(lastKm) && " ✓ 자동 입력됨"}
          </p>
        )}
      </div>

      {/* 목적 */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">
          {tripType === "업무" ? "업무 목적" : "출퇴근 구분"} <span className="text-destructive">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {purposes.map(p => (
            <button key={p} type="button" onClick={() => handlePurposeSelect(p)}
              className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors
                ${(!customPurpose && form.purpose === p) || (p === "기타" && customPurpose)
                  ? tripType === "출퇴근"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border"}`}>
              {p}
            </button>
          ))}
        </div>
        {customPurpose && (
          <input type="text" placeholder="직접 입력" value={form.purpose}
            onChange={e => set("purpose", e.target.value)} autoFocus
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 mt-2" />
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <button type="submit" disabled={isPending || !form.vehicle_id}
        className={`w-full rounded-xl py-4 text-base font-semibold disabled:opacity-50
          ${tripType === "출퇴근" ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground"}`}>
        {isPending ? "출발 등록 중..." : tripType === "업무" ? "🚗 운행 시작" : "🏠 출퇴근 시작"}
      </button>
    </form>
  );
}
