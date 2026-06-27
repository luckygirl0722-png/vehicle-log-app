"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import VehicleModal from "./VehicleModal";
import BulkImportVehicleModal, { type BulkVehicleItem } from "./BulkImportVehicleModal";
import AssignDriverModal from "./AssignDriverModal";
import type { Vehicle } from "@/types/database";

interface DriverBrief {
  id: string; name: string; employee_no: string; department: string; phone?: string | null;
}

const BULK_VEHICLES: BulkVehicleItem[] = [
  { plate_number: "231하3267", model: "아반떼", purpose: "영업용" },
  { plate_number: "223호3845", model: "아반떼", purpose: "영업용" },
  { plate_number: "223호3820", model: "아반떼", purpose: "영업용" },
  { plate_number: "192하8727", model: "k3",     purpose: "영업용" },
  { plate_number: "223하9306", model: "k3",     purpose: "영업용" },
  { plate_number: "190하1086", model: "베뉴",   purpose: "영업용" },
  { plate_number: "192허8465", model: "k3",     purpose: "영업용" },
  { plate_number: "190하1087", model: "베뉴",   purpose: "영업용" },
  { plate_number: "231하3266", model: "아반떼", purpose: "영업용" },
  { plate_number: "192하8772", model: "k3",     purpose: "영업용" },
  { plate_number: "191하8558", model: "싼타페", purpose: "영업용" },
  { plate_number: "190하4021", model: "아반떼", purpose: "영업용" },
  { plate_number: "190하9655", model: "싼타페", purpose: "영업용" },
  { plate_number: "192하8771", model: "k3",     purpose: "영업용" },
  { plate_number: "230허7071", model: "투싼",   purpose: "영업용" },
  { plate_number: "223허3161", model: "싼타페", purpose: "영업용" },
  { plate_number: "223하9309", model: "k3",     purpose: "영업용" },
  { plate_number: "230호6137", model: "그랜저", purpose: "영업용" },
  { plate_number: "223하9308", model: "k3",     purpose: "영업용" },
  { plate_number: "230호7089", model: "아반떼", purpose: "영업용" },
  { plate_number: "149저5441", model: "소나타", purpose: "영업용" },
  { plate_number: "223하7387", model: "그랜저", purpose: "영업용" },
  { plate_number: "223호2919", model: "아반떼", purpose: "영업용" },
  { plate_number: "223하9307", model: "k3",     purpose: "영업용" },
  { plate_number: "192허6058", model: "k3",     purpose: "영업용" },
  { plate_number: "192호7804", model: "스타리아", purpose: "영업용" },
  { plate_number: "379다8989", model: "팰리세이드", purpose: "영업용" },
];

interface VehiclesClientProps {
  vehicles: Vehicle[];
  allDrivers: DriverBrief[];
  driversByVehicle: Record<string, string[]>;
}

export default function VehiclesClient({ vehicles, allDrivers, driversByVehicle }: VehiclesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [modalOpen, setModalOpen]   = useState(false);
  const [bulkOpen, setBulkOpen]     = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selected, setSelected]     = useState<Vehicle | null>(null);
  const [assignTarget, setAssignTarget] = useState<Vehicle | null>(null);

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteMsg, setDeleteMsg]   = useState<string | null>(null);

  const allChecked = vehicles.length > 0 && checkedIds.size === vehicles.length;
  const someChecked = checkedIds.size > 0;

  function toggleAll() {
    if (allChecked) setCheckedIds(new Set());
    else setCheckedIds(new Set(vehicles.map(v => v.id)));
  }
  function toggleOne(id: string) {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openCreate() { setSelected(null); setModalOpen(true); }
  function openEdit(v: Vehicle) { setSelected(v); setModalOpen(true); }
  function openAssign(v: Vehicle) { setAssignTarget(v); setAssignOpen(true); }

  async function handleBulkDelete() {
    setDeleteMsg(null);
    startTransition(async () => {
      const ids = Array.from(checkedIds);
      let ok = 0;
      for (const id of ids) {
        const res = await fetch(`/api/vehicles/${id}`, { method: "DELETE" });
        if (res.ok) ok++;
      }
      setDeleteMsg(`${ok}/${ids.length}대 삭제 완료 (운행 기록 포함)`);
      setCheckedIds(new Set());
      setTimeout(() => { setConfirmOpen(false); setDeleteMsg(null); router.refresh(); }, 1200);
    });
  }

  const selectedPlates = vehicles.filter(v => checkedIds.has(v.id)).map(v => v.plate_number).join(", ");

  // 배정 운전자 없는 차량 수
  const unassignedCount = vehicles.filter(v => !(driversByVehicle[v.id]?.length > 0)).length;

  return (
    <>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">차량 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            총 {vehicles.length}대
            {unassignedCount > 0 && (
              <span className="ml-2 text-amber-600">· 운전자 미배정 {unassignedCount}대</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {someChecked && (
            <Button variant="destructive" onClick={() => setConfirmOpen(true)} disabled={isPending}>
              🗑 선택 삭제 ({checkedIds.size}대)
            </Button>
          )}
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            ⬆ 일괄 등록 ({BULK_VEHICLES.length}대)
          </Button>
          <Button onClick={openCreate}>+ 차량 등록</Button>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />운전자 배정 완료
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />운전자 미배정
        </span>
      </div>

      {/* 테이블 */}
      <div className="rounded-lg border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={allChecked} onChange={toggleAll}
                  className="rounded border-border cursor-pointer w-4 h-4" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">차량번호</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">차종</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">상태</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">배정 운전자</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">관리</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  등록된 차량이 없습니다
                </td>
              </tr>
            ) : (
              vehicles.map((v) => {
                const drivers = driversByVehicle[v.id] ?? [];
                const hasDrivers = drivers.length > 0;
                return (
                  <tr key={v.id}
                    className={`border-b last:border-0 hover:bg-muted/30 transition-colors
                      ${checkedIds.has(v.id) ? "bg-destructive/5" : ""}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={checkedIds.has(v.id)}
                        onChange={() => toggleOne(v.id)}
                        className="rounded border-border cursor-pointer w-4 h-4" />
                    </td>
                    <td className="px-4 py-3 font-medium">{v.plate_number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.model}</td>
                    <td className="px-4 py-3">
                      <Badge variant={v.is_active ? "success" : "outline"}>
                        {v.is_active ? "운행중" : "비활성"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {hasDrivers ? (
                        <div className="flex flex-wrap gap-1">
                          {drivers.map(name => (
                            <span key={name}
                              className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          미배정
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1.5">
                      <Button size="sm" variant="secondary" onClick={() => openAssign(v)}>운전자</Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(v)}>수정</Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 선택 삭제 확인 */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => !isPending && setConfirmOpen(false)} />
          <div className="relative z-10 bg-background rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 space-y-4">
            <h2 className="text-lg font-bold">차량 삭제 확인</h2>
            <p className="text-sm text-muted-foreground">
              아래 <strong>{checkedIds.size}대</strong>와 모든 운행 기록이 <strong className="text-destructive">영구 삭제</strong>됩니다.
            </p>
            <div className="rounded-xl bg-muted px-4 py-3 text-sm max-h-32 overflow-y-auto">{selectedPlates}</div>
            {deleteMsg && (
              <p className="text-sm text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">{deleteMsg}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isPending}>취소</Button>
              <Button variant="destructive" onClick={handleBulkDelete} disabled={isPending}>
                {isPending ? "삭제 중..." : "영구 삭제"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <VehicleModal open={modalOpen} onOpenChange={setModalOpen} vehicle={selected} />
      <BulkImportVehicleModal open={bulkOpen} onOpenChange={setBulkOpen} items={BULK_VEHICLES} onSuccess={() => router.refresh()} />
      {assignTarget && (
        <AssignDriverModal open={assignOpen} onOpenChange={setAssignOpen} vehicle={assignTarget} allDrivers={allDrivers} />
      )}
    </>
  );
}
