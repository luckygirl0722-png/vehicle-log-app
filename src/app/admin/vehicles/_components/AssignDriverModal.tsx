"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  drivers: DriverBrief;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vehicle: Vehicle;
  allDrivers: DriverBrief[];
}

export default function AssignDriverModal({ open, onOpenChange, vehicle, allDrivers }: Props) {
  const router = useRouter();
  const [assigned, setAssigned] = useState<AssignedDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  // 배정된 운전자 로드
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/vehicles/${vehicle.id}/drivers`)
      .then(r => r.json())
      .then(data => { setAssigned(Array.isArray(data) ? data : []); })
      .finally(() => setLoading(false));
  }, [open, vehicle.id]);

  const assignedIds = new Set(assigned.map(a => a.driver_id));

  const filtered = allDrivers.filter(d =>
    !assignedIds.has(d.id) &&
    (d.name.includes(search) || d.department.includes(search) || d.employee_no.includes(search))
  );

  function assign(driverId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/vehicles/${vehicle.id}/drivers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driverId }),
      });
      if (res.ok) {
        const d = allDrivers.find(d => d.id === driverId)!;
        const newRow = await res.json();
        setAssigned(prev => [...prev, { id: newRow.id, driver_id: driverId, drivers: d }]);
        router.refresh();
      }
    });
  }

  function unassign(assignedId: string, driverId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/vehicles/${vehicle.id}/drivers`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driverId }),
      });
      if (res.ok) {
        setAssigned(prev => prev.filter(a => a.id !== assignedId));
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            운전자 배정 — {vehicle.plate_number} {vehicle.model}
          </DialogTitle>
        </DialogHeader>

        {/* 현재 배정된 운전자 */}
        <div className="mb-1">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            배정된 운전자 ({assigned.length}명)
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground py-2">불러오는 중...</p>
          ) : assigned.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 border rounded-lg text-center">
              배정된 운전자 없음
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {assigned.map(a => (
                <div key={a.id}
                  className="flex items-center gap-1.5 bg-primary/10 rounded-full px-3 py-1 text-sm">
                  <span className="font-medium">{a.drivers.name}</span>
                  <span className="text-xs text-muted-foreground">{a.drivers.department}</span>
                  <button
                    onClick={() => unassign(a.id, a.driver_id)}
                    disabled={isPending}
                    className="ml-1 text-muted-foreground hover:text-destructive transition-colors text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <hr />

        {/* 운전자 검색 및 추가 */}
        <div className="flex-1 flex flex-col min-h-0">
          <p className="text-xs font-medium text-muted-foreground mb-2">운전자 추가</p>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 부서, 사원번호로 검색..."
            className="w-full border rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex-1 overflow-auto rounded-lg border text-sm">
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
      </DialogContent>
    </Dialog>
  );
}
