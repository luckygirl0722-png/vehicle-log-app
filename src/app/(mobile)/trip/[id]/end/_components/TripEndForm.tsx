"use client";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import LocationAutocomplete, { saveLocationHistory } from "@/app/(mobile)/_components/LocationAutocomplete";

interface Trip {
  id: string;
  departure_time: string;
  departure_km: number;
  departure_location: string;
  purpose: string;
  trip_type?: string | null;
  arrival_location?: string | null;
  arrival_km?: number | null;
  arrival_time?: string | null;
  toll_fee?: number | null;
  note?: string | null;
  vehicles?: { plate_number: string; model: string } | null;
}
interface Props { trip: Trip; isEditMode?: boolean; }

const TRIP_TYPES = ["업무", "출퇴근", "개인사용"] as const;
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

function toLocalDateStr(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  // KST offset
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth()+1)}-${pad(kst.getUTCDate())}`;
}
function toLocalTimeStr(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;
}
/** 도착 기본 시각: max(현재시각, 출발시각+1분) — 출발이 미래면 출발+1분으로 설정 */
function defaultArrivalIso(departurIso: string): string {
  const dep = new Date(departurIso);
  const now = new Date();
  return now > dep ? now.toISOString() : new Date(dep.getTime() + 60_000).toISOString();
}

const QUICK_LOCS = ["자택", "삼우에레코 본사", "가산동 사무소", "사무실"];

function getRecentLocations(exclude: string[], max = 5): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem("location_history") || "[]") as string[];
    return stored.filter(l => !exclude.includes(l)).slice(0, max);
  } catch { return []; }
}

export default function TripEndForm({ trip, isEditMode = false }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCancelling, startCancel]  = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentLocs, setRecentLocs] = useState<string[]>([]);

  useEffect(() => {
    setRecentLocs(getRecentLocations(QUICK_LOCS));
  }, []);

  const combinedLocs = [...QUICK_LOCS, ...recentLocs];

  const initTripType = (trip.trip_type ?? "업무") as "업무" | "출퇴근" | "개인사용";
  const [depTripType, setDepTripType] = useState<"업무" | "출퇴근" | "개인사용">(initTripType);

  // 수정 모드면 기존 값으로 pre-fill
  const [form, setForm] = useState({
    // 출발 정보 (수정 모드만 편집)
    dep_date:          toLocalDateStr(trip.departure_time),
    dep_time:          toLocalTimeStr(trip.departure_time),
    departure_location: trip.departure_location,
    departure_km:      String(trip.departure_km),
    purpose:           trip.purpose,
    // 도착 정보
    arrival_location: isEditMode ? (trip.arrival_location ?? "") : "",
    arrival_km:       isEditMode ? String(trip.arrival_km ?? "")  : "",
    toll_fee:         isEditMode ? String(trip.toll_fee ?? "0")   : "0",
    note:             isEditMode ? (trip.note ?? "")              : "",
    // 도착 시간 (항상 표시 — 기본값: 수정모드=기존값, 신규=max(현재,출발+1분))
    arr_date:         isEditMode && trip.arrival_time
      ? toLocalDateStr(trip.arrival_time)
      : toLocalDateStr(defaultArrivalIso(trip.departure_time)),
    arr_time:         isEditMode && trip.arrival_time
      ? toLocalTimeStr(trip.arrival_time)
      : toLocalTimeStr(defaultArrivalIso(trip.departure_time)),
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const depKmInt = parseInt(form.departure_km, 10);
  const arrKm    = parseInt(form.arrival_km, 10);
  const hasArrKm = !isNaN(arrKm) && form.arrival_km !== "";
  const distance = hasArrKm && !isNaN(depKmInt) ? arrKm - depKmInt : null;
  const distanceInvalid = distance !== null && distance <= 0;

  const btnColor =
    depTripType === "출퇴근"   ? "bg-emerald-600" :
    depTripType === "개인사용" ? "bg-orange-500"  : "bg-primary";

  async function handleCancel() {
    startCancel(async () => {
      const res = await fetch(`/api/trips/${trip.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/");
        router.refresh();
      }
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const arrivalKm  = parseInt(form.arrival_km, 10);
    const departKm   = parseInt(form.departure_km, 10);
    const tollFee    = parseInt(form.toll_fee, 10) || 0;

    if (isNaN(arrivalKm) || arrivalKm < 0) {
      setError("도착 km는 0 이상의 숫자를 입력하세요."); return;
    }
    if (isNaN(departKm) || departKm < 0) {
      setError("출발 km를 올바르게 입력하세요."); return;
    }
    if (arrivalKm < departKm) {
      setError(`도착 km(${arrivalKm})는 출발 km(${departKm}) 이상이어야 합니다.`); return;
    }

    startTransition(async () => {
      let res: Response;
      const depTimeISO = new Date(`${form.dep_date}T${form.dep_time}`).toISOString();

      // 이력에 위치 저장
      if (form.arrival_location) saveLocationHistory(form.arrival_location);
      if (isEditMode && form.departure_location) saveLocationHistory(form.departure_location);

      if (isEditMode) {
        // 이미 완료된 기록 수정 → PATCH /api/trips/[id] (출발+도착 모두)
        const arrTimeISO = form.arr_time
          ? new Date(`${form.arr_date}T${form.arr_time}`).toISOString()
          : undefined;
        const purposeLabel = depTripType !== "업무"
          ? `[${depTripType}] ${form.purpose.replace(/^\[출퇴근\]\s*|\[업무\]\s*|\[개인사용\]\s*/,"")}`
          : form.purpose.replace(/^\[출퇴근\]\s*|\[업무\]\s*|\[개인사용\]\s*/,"");
        res = await fetch(`/api/trips/${trip.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            departure_time:     depTimeISO,
            departure_location: form.departure_location,
            departure_km:       departKm,
            trip_type:          depTripType,
            purpose:            purposeLabel,
            arrival_location:   form.arrival_location,
            arrival_km:         arrivalKm,
            toll_fee:           tollFee,
            note:               form.note || undefined,
            ...(arrTimeISO ? { arrival_time: arrTimeISO } : {}),
          }),
        });
      } else {
        // 신규 도착 등록 → /api/trips/[id]/end
        const arrTimeISO = new Date(`${form.arr_date}T${form.arr_time}`).toISOString();
        res = await fetch(`/api/trips/${trip.id}/end`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            arrival_location: form.arrival_location,
            arrival_km:       arrivalKm,
            toll_fee:         tollFee,
            arrival_time:     arrTimeISO,
            note:             form.note || undefined,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "저장에 실패했습니다."); return; }
      router.push(`/trip/${trip.id}/complete`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 출발 정보 — 수정 모드: 편집 가능 / 일반 모드: 요약 표시 */}
      {isEditMode ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-wide">✏️ 출발 정보 수정</p>

          {/* 운행유형 */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">운행 유형</p>
            <div className="grid grid-cols-3 gap-1.5">
              {TRIP_TYPES.map(t => (
                <button key={t} type="button" onClick={() => setDepTripType(t)}
                  className={`rounded-lg py-2 text-xs font-semibold border-2 transition-colors
                    ${depTripType === t ? TYPE_COLOR[t] : "bg-background border-border text-foreground"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 출발 일시 */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">출발 일시</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={form.dep_date} onChange={e => set("dep_date", e.target.value)} required
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <input type="time" value={form.dep_time} onChange={e => set("dep_time", e.target.value)} required
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>

          {/* 출발지 */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">출발지</p>
            <LocationAutocomplete
              value={form.departure_location}
              onChange={v => set("departure_location", v)}
              placeholder="출발지를 입력하세요"
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}>
              {combinedLocs.map(loc => (
                <button key={loc} type="button" onClick={() => set("departure_location", loc)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium border whitespace-nowrap shrink-0 transition-colors
                    ${form.departure_location === loc ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* 출발 km */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">출발 계기판 km</p>
            <div className="relative">
              <input type="number" inputMode="numeric" value={form.departure_km} onChange={e => set("departure_km", e.target.value)} required min="0"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">km</span>
            </div>
          </div>

          {/* 목적 */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">목적</p>
            <div className="flex flex-wrap gap-1.5">
              {PURPOSES[depTripType].map(p => (
                <button key={p} type="button" onClick={() => set("purpose", p)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors
                    ${form.purpose === p || form.purpose.endsWith(p)
                      ? `${TYPE_COLOR[depTripType]} border-transparent`
                      : "bg-background border-border text-foreground"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-muted p-4 space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">출발 정보</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">차량</span>
            <span className="font-medium">{trip.vehicles?.plate_number ?? "—"}</span>
            <span className="text-muted-foreground">출발지</span>
            <span className="font-medium">{trip.departure_location}</span>
            <span className="text-muted-foreground">출발 km</span>
            <span className="font-medium">{trip.departure_km.toLocaleString("ko-KR")} km</span>
            <span className="text-muted-foreground">목적</span>
            <span className="font-medium">{trip.purpose}</span>
          </div>
        </div>
      )}

      {/* 도착 일시 (항상 표시) */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">도착 일시 <span className="text-destructive">*</span></label>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={form.arr_date} onChange={e => set("arr_date", e.target.value)} required
            className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <input type="time" value={form.arr_time} onChange={e => set("arr_time", e.target.value)} required
            className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
      </div>

      {/* ── 목적지 / 도착km / 통행료 — 한줄 그리드 레이아웃 ── */}
      <div className="rounded-xl border border-border bg-background overflow-hidden divide-y divide-border">

        {/* 목적지 */}
        <div className="flex items-start px-4 py-3 gap-3">
          <span className="w-[4.5rem] text-sm font-medium text-muted-foreground shrink-0 pt-2.5">목적지</span>
          <div className="flex-1 space-y-2 min-w-0">
            <LocationAutocomplete
              id="arr_loc"
              value={form.arrival_location}
              onChange={v => set("arrival_location", v)}
              placeholder="목적지를 입력하세요"
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {/* 빠른선택 + 최근이력 — 가로 스크롤 한줄 */}
            {combinedLocs.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}>
                {combinedLocs.map(loc => (
                  <button key={loc} type="button" onClick={() => set("arrival_location", loc)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border whitespace-nowrap shrink-0 transition-colors
                      ${form.arrival_location === loc
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                    {loc}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 도착 km */}
        <div className="flex items-center px-4 py-3 gap-3">
          <span className="w-[4.5rem] text-sm font-medium text-muted-foreground shrink-0">도착 km</span>
          <div className="relative flex-1">
            <input id="arr_km" type="number" inputMode="numeric"
              placeholder="계기판 숫자 입력하세요"
              value={form.arrival_km}
              onChange={e => set("arrival_km", e.target.value)}
              required min={trip.departure_km}
              className={`w-full rounded-lg border px-3 py-2.5 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2
                ${distanceInvalid
                  ? "border-destructive bg-destructive/5 focus:ring-destructive/50"
                  : "border-input bg-background focus:ring-primary/50"}`} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">km</span>
          </div>
        </div>

        {/* 운행거리 표시 */}
        <div className={`flex items-center justify-between px-4 py-2 text-xs font-medium
          ${!hasArrKm ? "bg-muted text-muted-foreground" : distanceInvalid ? "bg-destructive/10 text-destructive" : "bg-primary/5 text-primary"}`}>
          <span>운행거리</span>
          <span>
            {!hasArrKm
              ? "km 입력 후 자동 계산"
              : distanceInvalid
                ? `⚠️ 오류 (출발 ${depKmInt.toLocaleString("ko-KR")}km 이상 입력)`
                : `${distance!.toLocaleString("ko-KR")} km`}
          </span>
        </div>

        {/* 통행료 */}
        <div className="flex items-center px-4 py-3 gap-3">
          <span className="w-[4.5rem] text-sm font-medium text-muted-foreground shrink-0">통행료</span>
          <div className="relative flex-1">
            <input id="toll" type="number" inputMode="numeric" placeholder="0"
              value={form.toll_fee}
              onChange={e => set("toll_fee", e.target.value)} min="0"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">원</span>
          </div>
        </div>

      </div>

      {/* 비고 */}
      <div className="space-y-2">
        <label htmlFor="note" className="text-sm font-semibold">
          비고 <span className="text-muted-foreground text-xs font-normal">(선택)</span>
        </label>
        <textarea id="note" rows={2} placeholder="특이사항을 입력하세요"
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
        {isPending
          ? "저장 중..."
          : isEditMode ? "수정 완료" : "운행 완료"}
      </button>

      {/* 취소 버튼 — 도착 입력 중(신규)에만 표시 */}
      {!isEditMode && (
        <div className="mt-1">
          {!confirmCancel ? (
            <button type="button" onClick={() => setConfirmCancel(true)}
              className="w-full rounded-xl border border-border text-muted-foreground py-3 text-sm font-medium hover:bg-muted transition-colors">
              🚫 운행 취소 (기록 삭제)
            </button>
          ) : (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <p className="text-sm text-center text-destructive font-medium">정말 이 운행 기록을 삭제하시겠어요?</p>
              <p className="text-xs text-center text-muted-foreground">출발 기록이 삭제되며 복구할 수 없습니다.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmCancel(false)} disabled={isCancelling}
                  className="flex-1 rounded-xl border border-border bg-background py-3 text-sm font-medium">
                  아니오
                </button>
                <button type="button" onClick={handleCancel} disabled={isCancelling}
                  className="flex-1 rounded-xl bg-destructive text-white py-3 text-sm font-bold disabled:opacity-50">
                  {isCancelling ? "삭제 중..." : "예, 삭제합니다"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
