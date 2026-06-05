"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import VehicleModal from "./VehicleModal";
import DeleteConfirm from "./DeleteConfirm";
import type { Vehicle } from "@/types/database";

interface VehiclesClientProps {
  vehicles: Vehicle[];
}

export default function VehiclesClient({ vehicles }: VehiclesClientProps) {
  const [modalOpen, setModalOpen]     = useState(false);
  const [deleteOpen, setDeleteOpen]   = useState(false);
  const [selected, setSelected]       = useState<Vehicle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);

  function openCreate() { setSelected(null); setModalOpen(true); }
  function openEdit(v: Vehicle) { setSelected(v); setModalOpen(true); }
  function openDelete(v: Vehicle) { setDeleteTarget(v); setDeleteOpen(true); }

  return (
    <>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">차량 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            총 {vehicles.length}대
          </p>
        </div>
        <Button onClick={openCreate}>+ 차량 등록</Button>
      </div>

      {/* 테이블 */}
      <div className="rounded-lg border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">차량번호</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">차종</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">용도</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">상태</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">비고</th>
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
              vehicles.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{v.plate_number}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.model}</td>
                  <td className="px-4 py-3">
                    <Badge variant={v.purpose === "영업용" ? "default" : "secondary"}>
                      {v.purpose}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={v.is_active ? "success" : "outline"}>
                      {v.is_active ? "운행중" : "비활성"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{v.note ?? "—"}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(v)}>수정</Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openDelete(v)}
                      disabled={!v.is_active}
                    >
                      삭제
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 모달 */}
      <VehicleModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        vehicle={selected}
      />

      {/* 삭제 확인 */}
      {deleteTarget && (
        <DeleteConfirm
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          id={deleteTarget.id}
          name={deleteTarget.plate_number}
          endpoint="/api/vehicles/"
        />
      )}
    </>
  );
}
