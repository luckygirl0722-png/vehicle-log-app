"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import LocationAutocomplete, { saveLocationHistory, RecentLocationButtons } from "@/app/(mobile)/_components/LocationAutocomplete";

interface Props {
  vehicleId:    string;
  plateNumber:  string;
  vehicleModel: string;
  fromKm:       number;
  toKm:         number;
  driverName:   string;
}

const PURPOSES: Record<string, string[]> = {
  "업무":     ["고객사 방문","영업 미팅","부품 납품","자재 수령","현장 점검","사내 출장","기타"],
  "출퇴근":   ["출퇴근","출근","퇴근","기타"],
  "개인사용": ["개인 볼일","병원","장보기","가족 행사","기타"],
};

const TYPE_COLOR: Record<string, string> = {
  "업무":     "bg-primary text-primary-foreground border-primary",
  "출퇴근":   "bg-emerald-600 text-white border-emerald-600",
  "개인사용": "bg-orange-500 text-white border-orange-500",
};

function toLocalDateStr(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toLocalTimeStr(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function RetroactiveForm({ vehicleId, plateNumber, vehicleModel, fromKm, toKm, driverName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError]   = useState<string | null>(null);
  const [tripType, setTripType] = useState<"업무" | "출퇴근" | "개인사용">("업무");
  const [customPurpose, setCustomPurpose] = useState(false);

  const now = new Date();
  const [form, setForm] = useState({
    dep_date: toLocalDateStr(now),
    dep_time: toLocalTimeStr(now),
    arr_date: toLocalDateStr(now),
    arr_time: toLocalTimeStr(now),
    departure_location: "",
    arrival_location:   "",
    purpose:            PURPOSES["업무"][0],
    note:               "",
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const gapKm    = toKm - fromKm;
  const btnColor = tripType === "출퇴근" ? "bg-emerald-600" : tripType === "개인사용" ? "bg-orange-500" : "bg-primary";

  function handleTypeChange(t: "업무" | "출퇴근" | "개인사용") {
    setTripType(t);
    setCustomPurpose(false);
    setForm(f => ({ ...f, purpose: PURPOSES[t][0] }));
  }

  function handlePurposeSelect(p: string) {
    if (p === "기타") { setCustomPurpose(true); set("purpose", ""); }
    else { setCustomPurpose(false); set("purpose", p); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const depTime = new Date(`${form.dep_date}T${form.dep_time}`);
    const arrTime = new Date(`${form.arr_date}T${form.arr_time}`);

    if (isNaN(depTime.getTime())) { setError("출발 일시를 입력하세요."); return; }
    if (isNaN(arrTime.getTime())) { setError("도착 일시를 입력하세요."); return; }
    if (arrTime <= depTime)       { setError("도착 시간은 출발 시간 이후여야 합니다."); return; }
    if (!form.departure_location.trim()) { setError("출발지를 입력하세요."); return; }
    if (!form.arrival_location.trim())   { setError("도착지를 입력하세요."); return; }
    if (!form.purpose.trim())            { setError("목적을 입력하세요."); return; }

    startTransition(async () => {
      saveLocationHistory(form.departure_location);
      saveLocationHistory(form.arrival_location);

      const purposeLabel = tripType !== "업무"
        ? `[${tripType}] ${form.purpose}`
        : form.purpose;

      const res = await fetch("/api/trips/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id:         vehicleId,
          departure_time:     depTime.toISOString(),
          arrival_time:       arrTime.toISOString(),
          departure_location: form.departure_location,
          arrival_location:   form.arrival_location,
          departure_km:       fromKm,
          arrival_km:         toKm,
          toll_fee:           0,
          purpose:            purposeLabel,
          trip_type:          tripType,
          note:               form.note || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "저장에 실패했습니다."); return; }

      router.push("/vehicle-trips");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* 소급 입력 정보 배너 */}
      <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 space-y-1.5">
        <p className="text-xs font-semibold text-amber-800">⚠️ 소급 입력 구간</p>
        <div className="flex items-center gap-2 text-sm">
          <span className="bg-white border border-amber-300 rounded-lg px-2.5 py-1 font-bold text-amber-900">
            {fromKm.toLocaleString("ko-KR")} km
          </span>
          <span className="flex-1 text-center text-xs text-amber-500">· · · {gapKm.toLocaleString("ko-KR")} km · · ·</span>
          <span className="bg-white border border-amber-300 rounded-lg px-2.5 py-1 font-bold text-amber-900">
            {toKm.toLocaleString("ko-KR")} km
          </span>
        </div>
        <p className="text-xs text-amber-700">계기판 km은 고정됩니다. 날짜, 시간, 장소, 목적을 입력하세요.</p>
      </div>

      {/* 차량 정보 (고정) */}
      <div className="rounded-xl bg-muted px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{plateNumber}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{vehicleModel}</p>
        </div>
        <span className="text-xs text-muted-foreground bg-background border border-border rounded-full px-2.5 py-1">고정</span>
      </div>

      {/* 운행 유형 */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">운행 유형 <span className="text-destructive">*</span></label>
        <div className="grid grid-cols-3 gap-2">
          {(["업무", "출퇴근", "개인사용"] as const).map(t => (
            <button key={t} type="button" onClick={() => handleTypeChange(t)}
              className={`rounded-xl py-3 text-sm font-semibold border-2 transition-colors
                ${tripType === t ? TYPE_COLOR[t] : "bg-background border-border text-foreground"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 출발 일시 */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">출발 일시 <span className="text-destructive">*</span></label>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={form.dep_date} onChange={e => set("dep_date", e.target.value)} required
            className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <input type="time" value={form.dep_time} onChange={e => set("dep_time", e.target.value)} required
            className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
      </div>

      {/* 도착 일시 */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">도착 일시 <span className="text-destructive">*</span></label>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={form.arr_date} onChange={e => set("arr_date", e.target.value)} required
            className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <input type="time" value={form.arr_time} onChange={e => set("arr_time", e.target.value)} required
            className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
      </div>

      {/* 출발지 */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">출발지 <span className="text-destructive">*</span></label>
        <LocationAutocomplete
          value={form.departure_location}
          onChange={v => set("departure_location", v)}
          placeholder="출발지를 입력하세요"
          required
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <div className="flex flex-wrap gap-1.5">
          {["삼우에레코 본사", "가산동 사무소", "사무실", "자택"].map(loc => (
            <button key={loc} type="button" onClick={() => set("departure_location", loc)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors
                ${form.departure_location === loc ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
              {loc}
            </button>
          ))}
        </div>
        <RecentLocationButtons onSelect={v => set("departure_location", v)} current={form.departure_location} />
      </div>

      {/* 도착지 */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">도착지 <span className="text-destructive">*</span></label>
        <LocationAutocomplete
          value={form.arrival_location}
          onChange={v => set("arrival_location", v)}
          placeholder="목적지를 입력하세요"
          required
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <div className="flex flex-wrap gap-1.5">
          {["자택", "삼우에레코 본사", "가산동 사무소", "사무실"].map(loc => (
            <button key={loc} type="button" onClick={() => set("arrival_location", loc)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors
                ${form.arrival_location === loc ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
              {loc}
            </button>
          ))}
        </div>
        <RecentLocationButtons onSelect={v => set("arrival_location", v)} current={form.arrival_location} />
      </div>

      {/* 계기판 km (고정) */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">계기판 km</label>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground text-center">출발km</p>
            <div className="rounded-xl bg-primary/10 border border-primary/30 px-3 py-3 text-center text-sm font-bold text-primary">
              {fromKm.toLocaleString("ko-KR")}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground text-center">도착km</p>
            <div className="rounded-xl bg-primary/10 border border-primary/30 px-3 py-3 text-center text-sm font-bold text-primary">
              {toKm.toLocaleString("ko-KR")}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground text-center">운행거리</p>
            <div className="rounded-xl bg-emerald-50 border border-emerald-300 px-3 py-3 text-center text-sm font-bold text-emerald-700">
              {gapKm.toLocaleString("ko-KR")} km
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          🔒 km 연속성 유지를 위해 고정됩니다
        </p>
      </div>

      {/* 목적 */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">
          {tripType === "업무" ? "업무 목적" : tripType === "출퇴근" ? "출퇴근 구분" : "사용 목적"}
          <span className="text-destructive"> *</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {PURPOSES[tripType].map(p => (
            <button key={p} type="button" onClick={() => handlePurposeSelect(p)}
              className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors
                ${(!customPurpose && form.purpose === p) || (p === "기타" && customPurpose)
                  ? TYPE_COLOR[tripType] + " border-transparent"
                  : "bg-background text-foreground border-border"}`}>
              {p}
            </button>
          ))}
        </div>
        {customPurpose && (
          <input type="text" placeholder="직접 입력" value={form.purpose}
            onChange={e => set("purpose", e.target.value)} autoFocus
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 mt-1" />
        )}
      </div>

      {/* 비고 */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">비고 <span className="text-muted-foreground text-xs font-normal">(선택)</span></label>
        <textarea rows={2} placeholder="특이사항을 입력하세요"
          value={form.note} onChange={e => set("note", e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>

      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <button type="submit" disabled={isPending}
        className={`w-full rounded-xl ${btnColor} text-white py-4 text-base font-semibold disabled:opacity-50`}>
        {isPending ? "저장 중..." : "✅ 소급 입력 완료 (승인 요청)"}
      </button>

      <a href="/vehicle-trips"
        className="block w-full text-center rounded-xl border border-border text-muted-foreground py-3 text-sm font-medium">
        취소
      </a>
    </form>
  );
}
