"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Trip {
  id: string;
  departure_km: number;
  departure_location: string;
  purpose: string;
  vehicles?: { plate_number: string; model: string } | null;
}
interface Props { trip: Trip; }

export default function TripEndForm({ trip }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ arrival_location: "", arrival_km: "", toll_fee: "0", note: "" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const arrKm = parseInt(form.arrival_km, 10);
  const estimatedDistance = !isNaN(arrKm) && arrKm >= trip.departure_km ? arrKm - trip.departure_km : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const arrivalKm = parseInt(form.arrival_km, 10);
    const tollFee   = parseInt(form.toll_fee, 10) || 0;
    if (isNaN(arrivalKm) || arrivalKm < 0) { setError("도착 km는 0 이상의 숫자를 입력하세요."); return; }
    if (arrivalKm < trip.departure_km) {
      setError(`도착 km(${arrivalKm})는 출발 km(${trip.departure_km}) 이상이어야 합니다.`); return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/trips/${trip.id}/end`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arrival_location: form.arrival_location, arrival_km: arrivalKm, toll_fee: tollFee, note: form.note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "도착 등록에 실패했습니다."); return; }
      router.push(`/trip/${trip.id}/complete`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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

      <div className="space-y-2">
        <label htmlFor="arr_loc" className="text-sm font-semibold">목적지 <span className="text-destructive">*</span></label>
        <input id="arr_loc" type="text" inputMode="text" placeholder="현대자동차 남양연구소"
          value={form.arrival_location} onChange={e => set("arrival_location", e.target.value)} required
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>

      <div className="space-y-2">
        <label htmlFor="arr_km" className="text-sm font-semibold">도착 계기판 km <span className="text-destructive">*</span></label>
        <div className="relative">
          <input id="arr_km" type="number" inputMode="numeric" placeholder={String(trip.departure_km + 1)}
            value={form.arrival_km} onChange={e => set("arrival_km", e.target.value)} required min={trip.departure_km}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 pr-14 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">km</span>
        </div>
        {estimatedDistance !== null && (
          <p className="text-sm text-primary font-medium">운행거리: {estimatedDistance.toLocaleString("ko-KR")} km</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="toll" className="text-sm font-semibold">통행료 <span className="text-muted-foreground text-xs font-normal">(선택)</span></label>
        <div className="relative">
          <input id="toll" type="number" inputMode="numeric" placeholder="0"
            value={form.toll_fee} onChange={e => set("toll_fee", e.target.value)} min="0"
            className="w-full rounded-xl border border-input bg-background px-4 py-3 pr-10 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">원</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[0, 900, 1800, 2700, 5500, 7700].map(fee => (
            <button key={fee} type="button" onClick={() => set("toll_fee", String(fee))}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors
                ${parseInt(form.toll_fee) === fee ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border"}`}>
              {fee === 0 ? "없음" : fee.toLocaleString("ko-KR") + "원"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="note" className="text-sm font-semibold">비고 <span className="text-muted-foreground text-xs font-normal">(선택)</span></label>
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
        className="w-full rounded-xl bg-primary text-primary-foreground py-4 text-base font-semibold disabled:opacity-50">
        {isPending ? "도착 등록 중..." : "운행 완료"}
      </button>
    </form>
  );
}
