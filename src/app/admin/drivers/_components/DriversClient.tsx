"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DriverModal from "./DriverModal";
import DeleteConfirm from "../../vehicles/_components/DeleteConfirm";
import BulkImportDriverModal, { type BulkDriverItem } from "./BulkImportDriverModal";
import ResetPasswordDialog from "./ResetPasswordDialog";
import type { Driver } from "@/types/database";

/** 법인차량현황.xlsx 운전자 관리 시트 데이터 (이메일 포함) */
const BULK_DRIVERS: BulkDriverItem[] = [
  { employee_no: "20150003", name: "곽덕윤", department: "영업1팀",      phone: "010-6432-4774", email: "dygwak@samwooeleco.com" },
  { employee_no: "20150009", name: "김동현", department: "영업1팀",      phone: "010-6788-0014", email: "dhkim@samwooeleco.com" },
  { employee_no: "20220005", name: "김민균", department: "영업1그룹",    phone: "010-9294-9265", email: "kimmk@samwooeleco.com" },
  { employee_no: "20210012", name: "김민중", department: "영업3팀",      phone: "010-9874-7462", email: "mjkim@samwooeleco.com" },
  { employee_no: "20050001", name: "김성숙", department: "영업지원그룹", phone: "010-6807-1522", email: "sungsuk05@samwooeleco.com" },
  { employee_no: "20250004", name: "김일환", department: "AI센터",       phone: "010-3928-0918", email: "ihkim@samwooeleco.com" },
  { employee_no: "20130003", name: "김정화", department: "영업4팀",      phone: "010-9737-7781", email: "jhkim@samwooeleco.com" },
  { employee_no: "20160012", name: "노관호", department: "영업2팀",      phone: "010-4594-7523", email: "kwanho@samwooeleco.com" },
  { employee_no: "20180006", name: "박명은", department: "영업2팀",      phone: "010-4611-6861", email: "wret20@samwooeleco.com" },
  { employee_no: "20250006", name: "박승규", department: "AI사업부",     phone: "010-3264-2257", email: "sk.park@samwoo.ai" },
  { employee_no: "20200007", name: "서경호", department: "TS2팀",        phone: "010-9906-1554", email: "seokh@samwooeleco.com" },
  { employee_no: "20250013", name: "신재준", department: "영업3팀",      phone: "010-9931-3500", email: "jjshin@samwooeleco.com" },
  { employee_no: "20100006", name: "안진호", department: "시스템설계실", phone: "010-4458-5832", email: "openclosed@samwooeleco.com" },
  { employee_no: "20100004", name: "유경훈", department: "기술지원그룹", phone: "010-3317-9077", email: "ykhuni@samwooeleco.com" },
  { employee_no: "20130002", name: "이기홍", department: "상무",         phone: "010-3200-9917", email: "hong@samwooeleco.com" },
  { employee_no: "20250010", name: "이동훈", department: "신규BIZ팀",    phone: "010-6641-8380", email: "dhlee@samwooeleco.com" },
  { employee_no: "20230009", name: "이세홍", department: "영업1팀",      phone: "010-2898-6626", email: "sehong@samwooeleco.com" },
  { employee_no: "20150102", name: "이정훈", department: "영업2팀",      phone: "010-9361-0925", email: "jhlee@samwooeleco.com" },
  { employee_no: "20220010", name: "장지훈", department: "영업2팀",      phone: "010-9170-7545", email: "jhjang@samwooeleco.com" },
  { employee_no: "20051001", name: "전영남", department: "재경팀",       phone: "010-8883-3080", email: "jeonyn@samwooeleco.com" },
  { employee_no: "20250014", name: "조동희", department: "영업2팀",      phone: "010-7413-0040", email: "dhcho@samwooeleco.com" },
  { employee_no: "20250011", name: "조우석", department: "AI사업부",     phone: "010-2038-3662", email: "wsjoh@samwooeleco.com" },
  { employee_no: "20210001", name: "조현진", department: "영업1팀",      phone: "010-5211-3254", email: "jhj@samwooeleco.com" },
  { employee_no: "20200010", name: "주승진", department: "영업3팀",      phone: "010-9093-5400", email: "jusj@samwooeleco.com" },
  { employee_no: "20170009", name: "최경덕", department: "TS1팀",        phone: "010-2426-9590", email: "ckd@samwooeleco.com" },
  { employee_no: "20240002", name: "최승범", department: "영업2팀",      phone: "010-8794-2363", email: "steve.choi@samwooeleco.com" },
  { employee_no: "20220001", name: "김도현", department: "대구영업팀",   phone: "010-9599-9816", email: "de9599@samwootechno.com" },
  { employee_no: "20130001", name: "박종민", department: "대구영업팀",   phone: "010-4176-3690", email: "pjm@samwootechno.com" },
  { employee_no: "20250002", name: "이상민", department: "대구영업팀",   phone: "010-9093-3170", email: "sml@samwootechno.com" },
  { employee_no: "20240001", name: "전희수", department: "대구영업그룹",    phone: "010-9068-4145", email: "heesoo73091@samwootechno.com" },
  { employee_no: "20110002", name: "추민정", department: "대구영업지원팀",  phone: "010-5320-6853", email: "mjchu@samwootechno.com" },
];

interface VehicleBrief {
  id: string;
  plate_number: string;
  model: string;
}

interface DriversClientProps {
  drivers: Driver[];
  driverVehicleMap: Record<string, VehicleBrief[]>;
}

export default function DriversClient({ drivers, driverVehicleMap }: DriversClientProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen]       = useState(false);
  const [deleteOpen, setDeleteOpen]     = useState(false);
  const [bulkOpen, setBulkOpen]         = useState(false);
  const [resetOpen, setResetOpen]       = useState(false);
  const [selected, setSelected]         = useState<Driver | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const [resetTarget, setResetTarget]   = useState<Driver | null>(null);

  function openCreate() { setSelected(null); setModalOpen(true); }
  function openEdit(d: Driver) { setSelected(d); setModalOpen(true); }
  function openDelete(d: Driver) { setDeleteTarget(d); setDeleteOpen(true); }
  function openReset(d: Driver) { setResetTarget(d); setResetOpen(true); }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">운전자 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">총 {drivers.length}명</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            ⬆ 일괄 등록 ({BULK_DRIVERS.length}명)
          </Button>
          <Button onClick={openCreate}>+ 운전자 등록</Button>
        </div>
      </div>

      <div className="rounded-lg border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {["사원번호","이름","부서","휴대폰","배정 차량","계정 연결","상태","관리"].map((h, i) => (
                <th key={h}
                  className={`px-4 py-3 font-medium text-muted-foreground ${i === 7 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drivers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  등록된 운전자가 없습니다
                </td>
              </tr>
            ) : (
              drivers.map((d) => {
                const assignedVehicles = driverVehicleMap[d.id] ?? [];
                return (
                  <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{d.employee_no}</td>
                    <td className="px-4 py-3 font-medium">{d.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.department}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      {assignedVehicles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">미배정</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {assignedVehicles.map(v => (
                            <span key={v.id}
                              className="inline-block rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5 font-medium">
                              {v.plate_number}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
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
                      {d.user_id && d.email && (
                        <Button
                          size="sm" variant="outline"
                          className="text-amber-600 border-amber-300 hover:bg-amber-50"
                          onClick={() => openReset(d)}
                        >
                          비번 초기화
                        </Button>
                      )}
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
                );
              })
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

      {resetTarget && resetTarget.email && (
        <ResetPasswordDialog
          open={resetOpen}
          onOpenChange={setResetOpen}
          driverId={resetTarget.id}
          driverName={resetTarget.name}
          email={resetTarget.email}
        />
      )}

      <BulkImportDriverModal
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        items={BULK_DRIVERS}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
