"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import LocationAutocomplete, { saveLocationHistory, RecentLocationButtons } from "@/app/(mobile)/_components/LocationAutocomplete";

interface Vehicle { id: string; plate_number: string; model: string; }
interface Driver  { id: string; name: string; }
interface Props   {
  vehicles:       Vehicle[];
  driver:         Driver;
  lastKmMap:      Record<string, number>;
  quickLocations: string[];
}

const PURPOSES: Record<string, string[]> = {
  "업무":   ["고객사 방문","영업 미팅","부품 납품","자재 수령","현장 점검","사내 출장","기타"],
  "출퇴근": ["출퇴근","출근","퇴근","기타"],
  "개인사용": ["개인 볼일","병원","장보기","가족 행사","기타"],
};

const TYPE_STYLE: Record<string, { active: string; btn: string; emoji: string }> = {
  "업무":     { active: "bg-primary text-primary-foreground border-primary", btn: "bg-primary text-primary-foreground", emoji: "🚗" },
  "출퇴근":   { active: "bg-emerald-600 text-white border-emerald-600",       btn: "bg-emerald-600 text-white",           emoji: "🏠" },
  "개인사용": { active: "bg-orange-500 text-white border-orange-500",          btn: "bg-orange-500 text-white",            emoji: "👤" },
};

function toLocalDateTimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toLocalDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function toLocalTimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TripStartForm({ vehicles, driver, lastKmMap, quickLocations }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError]      = useState<string | null>(null);
  const [tripType, setTripType] = useState<"업무" | "출퇴근" | "개인사용">("업무");
  const [customPurpose, setCustomPurpose] = useState(false);
  const now = new Date();

  const [form, setForm] = useState({
    vehicle_id:         vehicles[0]?.id ?? "",
    departure_location: "",
    departure_km:       lastKmMap[vehicles[0]?.id ?? ""] ? String(lastKmMap[vehicles[0]?.id ?? ""]) : "",
    purpose:            PURPOSES["업무"][0],
    departure_date:     toLocalDateString(now),
    departure_time_val: toLocalTimeString(now),
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  function handleVehicleSelect(vehicleId: string) {
    const lastKm = lastKmMap[vehicleId];
    setForm(f => ({ ...f, vehicle_id: vehicleId, departure_km: lastKm !== undefined ? String(lastKm) : "" }));
  }

  function handleTypeChange(type: "업무" | "출퇴근" | "개인사용") {
    setTripType(type);
    setCustomPurpose(false);
    setForm(f => ({ ...f, purpose: PURPOSES[type][0] }));
  }

  function handlePurposeSelect(p: string) {
    if (p === "기타") { setCustomPurpose(true); set("purpose", ""); }
    else { setCustomPurpose(false); set("purpose", p); }
  }

  const purposes = PURPOSES[tripType];
  const lastKm   = lastKmMap[form.vehicle_id];
  const style    = TYPE_STYLE[tripType];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const depKm = parseInt(form.departure_km, 10);
    if (isNaN(depKm) || depKm < 0) { setError("출발 km를 입력하세요."); return; }
    if (!form.purpose.trim()) { setError("목적을 입력하세요."); return; }
    startTransition(async () => {
      saveLocationHistory(form.departure_location);
      const purposeLabel = tripType !== "업무" ? `[${tripType}] ${form.purpose}` : form.purpose;
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: form.vehicle_id,
          driver_id:  driver.id,
          departure_location: form.departure_location,
          departure_km: depKm,
          purpose: purposeLabel,
          departure_time: new Date(`${form.departure_date}T${form.departure_time_val}`).toISOString(),
          trip_type: tripType,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "출발 등록 실패"); return; }
      router.push(`/trip/${data.id}/end`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* 운행 유형 */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">운행 유형 <span className="text-destructive">*</span></label>
        <div className="grid grid-cols-3 gap-2">
          {(["업무", "출퇴근", "개인사용"] as const).map(type => (
            <button key={type} type="button" onClick={() => handleTypeChange(type)}
              className={`rounded-xl py-3 text-sm font-semibold border-2 transition-colors
                ${tripType === type ? TYPE_STYLE[type].active : "bg-background border-border text-foreground"}`}>
              {TYPE_STYLE[type].emoji} {type}
            </button>
          ))}
        </div>
        {tripType === "개인사용" && (
          <p className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
            ⚠️ 개인사용 운행은 비용이 개인 부담으로 처리됩니다.
          </p>
        )}
      </div>

      {/* 날짜/시간 */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">출발 일시 <span className="text-destructive">*</span></label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">날짜</p>
            <input type="date" value={form.departure_date}
              onChange={e => set("departure_date", e.target.value)} required
              className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">시간</p>
            <input type="time" value={form.departure_time_val}
              onChange={e => set("departure_time_val", e.target.value)} required
              className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
        </div>
        {form.departure_date && (
          <p className="text-xs text-muted-foreground">
            {new Date(`${form.departure_date}T${form.departure_time_val || "00:00"}`).toLocaleDateString("ko-KR", { year:"numeric", month:"long", day:"numeric", weekday:"long" })}
          </p>
        )}
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
                  <p className="text-xs text-muted-foreground">이전 {lastKmMap[v.id].toLocaleString("ko-KR")} km</p>
                )}
                {form.vehicle_id === v.id && <span className="text-primary font-bold">✓</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 출발지 */}
      <div className="space-y-2">
        <label htmlFor="dep_loc" className="text-sm font-semibold">출발지 <span className="text-destructive">*</span></label>
        <LocationAutocomplete
          id="dep_loc"
          value={form.departure_location}
          onChange={v => set("departure_location", v)}
          placeholder="출발지를 입력하세요"
          required
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {quickLocations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {quickLocations.map(loc => (
              <button key={loc} type="button" onClick={() => set("departure_location", loc)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors
                  ${form.departure_location === loc ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                {loc}
              </button>
            ))}
          </div>
        )}
        <RecentLocationButtons
          onSelect={v => set("departure_location", v)}
          current={form.departure_location}
          exclude={quickLocations}
        />
      </div>

      {/* 출발 km */}
      <div className="space-y-2">
        <label htmlFor="dep_km" className="text-sm font-semibold">출발 계기판 km <span className="text-destructive">*</span></label>
        <div className="relative">
          <input id="dep_km" type="number" inputMode="numeric"
            placeholder={lastKm !== undefined ? `이전 ${lastKm.toLocaleString("ko-KR")}` : "45200"}
            value={form.departure_km} onChange={e => set("departure_km", e.target.value)} required min="0"
            className="w-full rounded-xl border border-input bg-background px-4 py-3 pr-14 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">km</span>
        </div>
        {lastKm !== undefined && (
          <p className="text-xs text-primary">이전 도착: {lastKm.toLocaleString("ko-KR")} km {form.departure_km === String(lastKm) ? "✓ 자동 입력됨" : ""}</p>
        )}
      </div>

      {/* 목적 */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">
          {tripType === "업무" ? "업무 목적" : tripType === "출퇴근" ? "출퇴근 구분" : "사용 목적"} <span className="text-destructive">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {purposes.map(p => (
            <button key={p} type="button" onClick={() => handlePurposeSelect(p)}
              className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors
                ${(!customPurpose && form.purpose === p) || (p === "기타" && customPurpose)
                  ? style.btn + " border-transparent"
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
        className={`w-full rounded-xl py-4 text-base font-semibold disabled:opacity-50 ${style.btn}`}>
        {isPending ? "출발 등록 중..." : `${style.emoji} ${tripType} 운행 시작`}
      </button>
    </form>
  );
}
