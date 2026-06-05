import {
  getPendingTrips,
  markSynced,
  clearSyncedTrips,
  type PendingTrip,
} from "./db";

export interface SyncResult {
  success: number;
  failed:  number;
  errors:  string[];
}

/**
 * 오프라인 중 저장된 미동기화 기록을 서버에 전송합니다.
 * 온라인 복귀 감지 시 자동 호출됩니다.
 */
export async function syncPendingTrips(): Promise<SyncResult> {
  const pending = await getPendingTrips();
  const result: SyncResult = { success: 0, failed: 0, errors: [] };

  if (!pending.length) return result;

  for (const trip of pending) {
    try {
      if (trip.type === "start") {
        await syncStart(trip, result);
      } else if (trip.type === "end" && trip.serverTripId) {
        await syncEnd(trip, result);
      }
    } catch (err: any) {
      result.failed++;
      result.errors.push(err.message ?? "알 수 없는 오류");
    }
  }

  // 성공적으로 동기화된 기록 정리
  if (result.success > 0) {
    await clearSyncedTrips();
  }

  return result;
}

async function syncStart(trip: PendingTrip, result: SyncResult): Promise<void> {
  const res = await fetch("/api/trips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vehicle_id:         trip.vehicle_id,
      driver_id:          trip.driver_id,
      departure_location: trip.departure_location,
      departure_km:       trip.departure_km,
      purpose:            trip.purpose,
      departure_time:     trip.departure_time,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `출발 등록 실패 (${res.status})`);
  }

  const data = await res.json();
  await markSynced(trip.localId, data.id);
  result.success++;
}

async function syncEnd(trip: PendingTrip, result: SyncResult): Promise<void> {
  const res = await fetch(`/api/trips/${trip.serverTripId}/end`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      arrival_location: trip.arrival_location,
      arrival_km:       trip.arrival_km,
      toll_fee:         trip.toll_fee ?? 0,
      note:             trip.note,
      arrival_time:     trip.arrival_time,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `도착 등록 실패 (${res.status})`);
  }

  await markSynced(trip.localId, trip.serverTripId!);
  result.success++;
}

/**
 * 네트워크 상태 변화 감지 → 온라인 복귀 시 자동 동기화
 */
export function setupOnlineSync(onComplete?: (result: SyncResult) => void): () => void {
  const handler = async () => {
    if (!navigator.onLine) return;
    const result = await syncPendingTrips();
    if (result.success > 0 || result.failed > 0) {
      onComplete?.(result);
    }
  };

  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}
