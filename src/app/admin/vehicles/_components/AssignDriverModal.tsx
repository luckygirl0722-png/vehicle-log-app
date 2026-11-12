"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Vehicle } from "@/types/database";

interface DriverBrief {
  id: string;
  name: string;
  employee_no: string;
  department: string;
  phone?: string | null;
}

interface AssignedDriver {
  id: string; // vehicle_drivers.id
  driver_id: string;
  priority?: number;
  drivers: DriverBrief;
}

interface HistoryRow {
  id: string;
  driver_id: string;
  start_date: string;
  end_date: string | null;
  note: string | null;
  drivers: { name: string; department: string } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vehicle: Vehicle;
  allDrivers: DriverBrief[];
}

/** 오늘(KST) YYYY-MM-DD */
const todayKst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

export default function AssignDriverModal({ open, onOpenChange, vehicle, allDrivers }: Props) {
  const router = useRouter();
  const [assigned, setAssigned] = useState<AssignedDriver[]>([]);
  const [history, setHistory]   = useState<HistoryRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch]     = useState("");
  const [changeDate, setChangeDate] = useState(todayKst());
  const [msg, setMsg]           = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/vehicles/${vehicle.id}/drivers`).then(r => r.json()),
      fetch(`/api/vehicles/${vehicle.id}/history`).then(r => r.json()).catch(() => []),
    ])
      .then(([a, h]) => {
        setAssigned(Array.isArray(a) ? a : []);
        setHistory(Array.isArray(h) ? h : []);
      })
      .finally(() => setLoading(false));
  }, [vehicle.id]);

  useEffect(() => {
    if (!open) return;
    setChangeDate(todayKst());
    setMsg(null);
    load();
  }, [open, load]);

  const assignedIds = new Set(assigned.map(a => a.driver_id));

  const filtered = allDrivers.filter(d =>
    !assignedIds.has(d.id) &&
    (d.name.includes(search) || d.department.includes(search) || d.employee_no.includes(search))
  );

  async function call(method: "POST" | "DELETE" | "PATCH", body: Record<string, unknown>) {
    const res = await fetch(`/api/vehicles/${vehicle.id}/drivers`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error ?? "처리 중 오류가 발생했습니다.");
      return false;
    }
    return true;
  }

  function assign(driverId: string) {
    setMsg(null);
    startTransition(async () => {
      if (await call("POST", { driver_id: driverId, start_date: changeDate })) {
        load();
        router.refresh();
      }
    });
  }

  function unassign(driverId: string) {
    setMsg(null);
    startTransition(async () => {
      if (await call("DELETE", { driver_id: driverId, end_date: changeDate })) {
        load();
        router.refresh();
      }
    });
  }

  function changePriority(driverId: string, priority: number) {
    setMsg(null);
    setAssigned(prev => prev.map(a => a.driver_id === driverId ? { ...a, priority } : a));
    startTransition(async () => {
      if (await call("PATCH", { driver_id: driverId, priority })) router.refresh();
    });
  }

  const vehicleDisposed = vehicle.status && vehicle.status !== "운행중";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            운전자 배정 — {vehicle.plate_number} {vehicle.model}
          </DialogTitle>
        </DialogHeader>

        {vehicleDisposed && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">
            이 차량은 {vehicle.status} 상태입니다. 운전자 앱에는 표시되지 않습니다.
          </p>
        )}

        {/* 변경 기준일 */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs font-medium text-muted-foreground">배정·해제 기준일</span>
          <input
            type="date"
            value={changeDate}
            onChange={e => setChangeDate(e.target.value || todayKst())}
            className="border rounded-md px-2 py-1 text-sm"
          />
          <span className="text-xs text-muted-foreground">사용자 변경 이력에 이 날짜로 기록됩니다</span>
        </div>

        {/* 현재 배정된 운전자 */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            현재 사용자 ({assigned.length}명) · 순위 = 해당 운전자의 차량 우선순위 (1이 기본 차량)
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground py-2">불러오는 중...</p>
          ) : assigned.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 border rounded-lg text-center">
              배정된 운전자 없음
            </p>
          ) : (
            <div className="rounded-lg border divide-y">
              {assigned.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="font-medium">{a.drivers.name}</span>
                  <span className="text-xs text-muted-foreground flex-1">{a.drivers.department}</span>
                  {a.priority !== undefined && (
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      순위
                      <select
                        value={a.priority}
                        onChange={e => changePriority(a.driver_id, Number(e.target.value))}
                        disabled={isPending}
                        className="border rounded px-1 py-0.5 text-xs text-foreground">
                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                  )}
                  <Button size="sm" variant="outline"
                    onClick={() => unassign(a.driver_id)} disabled={isPending}
                    className="h-7 text-xs">
                    해제
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {msg && <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{msg}</p>}

        <hr />

        {/* 운전자 검색 및 추가 */}
        <div className="flex flex-col min-h-0">
          <p className="text-xs font-medium text-muted-foreground mb-2">운전자 추가 (사용자 변경 시: 기존 사용자 해제 → 새 사용자 배정)</p>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 부서, 사원번호로 검색..."
            className="w-full border rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="max-h-48 overflow-auto rounded-lg border text-sm">
            {filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">
                {search ? "검색 결과 없음" : "추가 가능한 운전자 없음"}
              </p>
            ) : (
              filtered.map(d => (
                <div key={d.id}
                  className="flex items-center justify-between px-4 py-2.5 border-b last:border-0 hover:bg-muted/30">
                  <div>
                    <span className="font-medium">{d.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{d.department}</span>
                    <span className="text-xs text-muted-foreground ml-1">· {d.employee_no}</span>
                  </div>
                  <Button size="sm" variant="outline"
                    onClick={() => assign(d.id)} disabled={isPending}>
                    + 배정
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 사용자 변경 이력 */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 mt-1">사용자 변경 이력</p>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 border rounded-lg text-center">
              이력 없음 (DB 마이그레이션 003 적용 후 기록됩니다)
            </p>
          ) : (
            <div className="max-h-40 overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">운전자</th>
                    <th className="px-3 py-1.5 text-left font-medium">사용 기간</th>
                    <th className="px-3 py-1.5 text-left font-medium">비고</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} className="border-t">
                      <td className="px-3 py-1.5 font-medium">{h.drivers?.name ?? "—"}</td>
                      <td className="px-3 py-1.5">
                        {h.start_date} ~ {h.end_date ?? <span className="text-emerald-700 font-medium">사용중</span>}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">{h.note ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
