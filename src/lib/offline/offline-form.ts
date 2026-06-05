import { savePendingTrip, type PendingTrip } from "./db";

/** localId 생성 (crypto.randomUUID fallback) */
function generateLocalId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 출발 등록 — 오프라인 시 IndexedDB에 저장
 * 온라인 시에는 직접 API 호출
 */
export async function submitTripStart(data: {
  vehicle_id:         string;
  driver_id:          string;
  departure_location: string;
  departure_km:       number;
  purpose:            string;
}): Promise<{ offline: boolean; localId?: string; serverId?: string }> {
  if (navigator.onLine) {
    // 온라인: 직접 서버 전송
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "출발 등록 실패");
    }
    const result = await res.json();
    return { offline: false, serverId: result.id };
  }

  // 오프라인: IndexedDB 임시 저장
  const pending: PendingTrip = {
    localId:   generateLocalId(),
    type:      "start",
    createdAt: new Date().toISOString(),
    synced:    false,
    ...data,
    departure_time: new Date().toISOString(),
  };
  await savePendingTrip(pending);
  return { offline: true, localId: pending.localId };
}

/**
 * 도착 등록 — 오프라인 시 IndexedDB에 저장
 */
export async function submitTripEnd(
  tripId: string,
  data: {
    arrival_location: string;
    arrival_km:       number;
    toll_fee:         number;
    note?:            string;
  },
  isLocalId = false
): Promise<{ offline: boolean }> {
  if (navigator.onLine && !isLocalId) {
    const res = await fetch(`/api/trips/${tripId}/end`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "도착 등록 실패");
    }
    return { offline: false };
  }

  // 오프라인: IndexedDB에 도착 기록 저장
  const pending: PendingTrip = {
    localId:      generateLocalId(),
    type:         "end",
    createdAt:    new Date().toISOString(),
    synced:       false,
    serverTripId: isLocalId ? undefined : tripId,
    ...data,
    arrival_time: new Date().toISOString(),
  };
  await savePendingTrip(pending);
  return { offline: true };
}
