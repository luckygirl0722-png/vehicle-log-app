"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DriverModal from "./DriverModal";
import DeleteConfirm from "../../vehicles/_components/DeleteConfirm";
import type { Driver } from "@/types/database";

interface DriversClientProps {
  drivers: Driver[];
}

export default function DriversClient({ drivers }: DriversClientProps) {
  const [modalOpen, setModalOpen]       = useState(false);
  const [deleteOpen, setDeleteOpen]     = useState(false);
  const [selected, setSelected]         = useState<Driver | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);

  function openCreate() { setSelected(null); setModalOpen(true); }
  function openEdit(d: Driver) { setSelected(d); setModalOpen(true); }
  function openDelete(d: Driver) { setDeleteTarget(d); setDeleteOpen(true); }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">운전자 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">총 {drivers.length}명</p>
        </div>
        <Button onClick={openCreate}>+ 운전자 등록</Button>
      </div>

      <div className="rounded-lg border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {["사원번호","이름","부서","휴대폰","계정 연결","상태","관리"].map((h, i) => (
                <th key={h}
                  className={`px-4 py-3 font-medium text-muted-foreground ${i === 6 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drivers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  등록된 운전자가 없습니다
                </td>
              </tr>
            ) : (
              drivers.map((d) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{d.employee_no}</td>
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.department}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={d.user_id ? "success" : "outline"}>
                      {d.user_id ? "연결됨" : "미연결"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={d.is_active ? "success" : "outline"}>
                      {d.is_active ? "재직중" : "비활성"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(d)}>수정</Button>
                    <Button
                      size="sm" variant="destructive"
                      onClick={() => openDelete(d)}
                      disabled={!d.is_active}
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

      <DriverModal open={modalOpen} onOpenChange={setModalOpen} driver={selected} />

      {deleteTarget && (
        <DeleteConfirm
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          id={deleteTarget.id}
          name={`${deleteTarget.name}(${deleteTarget.employee_no})`}
          endpoint="/api/drivers/"
        />
      )}
    </>
  );
}
