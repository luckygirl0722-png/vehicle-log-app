/**
 * IndexedDB 래퍼 — 오프라인 운행 기록 임시 저장
 * 외부 라이브러리 없이 native IndexedDB API 사용
 */

const DB_NAME    = "vehicle-log-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending-trips";

/** 오프라인으로 임시 저장할 운행 기록 타입 */
export interface PendingTrip {
  localId:             string;    // UUID (로컬 생성)
  type:                "start" | "end";
  createdAt:           string;    // ISO timestamp
  synced:              boolean;
  serverTripId?:       string;    // 서버 동기화 후 채워짐

  // 출발 등록 데이터
  vehicle_id?:         string;
  driver_id?:          string;
  departure_location?: string;
  departure_km?:       number;
  purpose?:            string;
  departure_time?:     string;

  // 도착 등록 데이터
  arrival_location?:   string;
  arrival_km?:         number;
  toll_fee?:           number;
  note?:               string;
  arrival_time?:       string;
}

/** DB 연결 (싱글턴 패턴) */
let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db    = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "localId" });
        store.createIndex("synced",    "synced",    { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror   = ()  => reject(req.error);
  });

  return dbPromise;
}

/** 미동기화 기록 저장 */
export async function savePendingTrip(trip: PendingTrip): Promise<void> {
  const db    = await getDb();
  const store = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.put(trip);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/** 미동기화 기록 전체 조회 */
export async function getPendingTrips(): Promise<PendingTrip[]> {
  const db    = await getDb();
  const store = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME);
  const idx   = store.index("synced");
  return new Promise((resolve, reject) => {
    const req = idx.getAll(IDBKeyRange.only(false));
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror   = () => reject(req.error);
  });
}

/** 동기화 완료 처리 */
export async function markSynced(localId: string, serverTripId: string): Promise<void> {
  const db    = await getDb();
  const tx    = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const getReq = store.get(localId);
    getReq.onsuccess = () => {
      const trip = getReq.result as PendingTrip | undefined;
      if (!trip) { resolve(); return; }
      const putReq = store.put({ ...trip, synced: true, serverTripId });
      putReq.onsuccess = () => resolve();
      putReq.onerror   = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/** 동기화된 기록 삭제 (정리) */
export async function clearSyncedTrips(): Promise<number> {
  const db    = await getDb();
  const store = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME);
  const idx   = store.index("synced");
  return new Promise((resolve, reject) => {
    let count = 0;
    const req = idx.openCursor(IDBKeyRange.only(true));
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result as IDBCursorWithValue | null;
      if (cursor) { cursor.delete(); count++; cursor.continue(); }
      else resolve(count);
    };
    req.onerror = () => reject(req.error);
  });
}

/** 미동기화 기록 수 조회 */
export async function getPendingCount(): Promise<number> {
  const db    = await getDb();
  const store = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME);
  const idx   = store.index("synced");
  return new Promise((resolve, reject) => {
    const req = idx.count(IDBKeyRange.only(false));
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
