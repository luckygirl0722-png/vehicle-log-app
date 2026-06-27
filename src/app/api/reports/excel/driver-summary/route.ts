import { NextRequest, NextResponse } from "next/server";
import { withAuth, badReq, serverErr } from "@/lib/api/auth-guard";
import * as XLSX from "xlsx";

const COMPANY_NAME = "삼우에레코주식회사";

/**
 * GET /api/reports/excel/driver-summary
 * 대시보드 "운전자별 운행 집계" 테이블과 동일한 형식의 Excel 생성
 * 쿼리 파라미터:
 *   - year:  number (필수)
 *   - month: number (필수, 1~12)
 */
export async function GET(request: NextRequest) {
  const { supabase, error } = await withAuth(true);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const yearStr  = searchParams.get("year");
  const monthStr = searchParams.get("month");

  if (!yearStr || !monthStr) return badReq("year와 month는 필수 파라미터입니다.");
  const year  = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (isNaN(year) || year < 2020 || year > 2100) return badReq("year가 올바르지 않습니다.");
  if (isNaN(month) || month < 1 || month > 12)   return badReq("month는 1~12 사이여야 합니다.");

  const from = new Date(year, month - 1, 1).toISOString();
  const to   = new Date(year, month,     1).toISOString();

  // 해당 월 운행 기록 (운전자+차량 정보 포함)
  const { data: trips, error: tErr } = await supabase!
    .from("trip_logs")
    .select("driver_id, vehicle_id, distance_km, toll_fee, trip_type, drivers(name), vehicles(plate_number, model)")
    .gte("departure_time", from)
    .lt("departure_time", to)
    .not("arrival_time", "is", null);
  if (tErr) return serverErr(tErr.message);
  if (!trips?.length) return badReq("해당 기간에 운행 기록이 없습니다.");

  // 운전자별 집계
  interface VRow { vehicle_id: string; plate_number: string; model: string; bizKm: number; bizToll: number; comKm: number; comToll: number; perKm: number; perToll: number; totalKm: number; tripCount: number; }
  interface DRow { driver_name: string; bizKm: number; bizToll: number; comKm: number; comToll: number; perKm: number; perToll: number; totalKm: number; tripCount: number; vehicles: VRow[]; }
  const driverMap: Record<string, DRow> = {};

  (trips as any[]).forEach(row => {
    const did   = row.driver_id ?? "unknown";
    const dname = row.drivers?.name ?? "미상";
    const vid   = row.vehicle_id ?? "unknown";
    const plate = row.vehicles?.plate_number ?? "—";
    const model = row.vehicles?.model ?? "—";
    const km    = row.distance_km ?? 0;
    const tol   = row.toll_fee ?? 0;
    const type  = row.trip_type ?? "업무";

    if (!driverMap[did]) driverMap[did] = { driver_name: dname, bizKm: 0, bizToll: 0, comKm: 0, comToll: 0, perKm: 0, perToll: 0, totalKm: 0, tripCount: 0, vehicles: [] };
    const ds = driverMap[did];
    ds.totalKm += km; ds.tripCount += 1;
    if (type === "출퇴근")   { ds.comKm += km; ds.comToll += tol; }
    else if (type === "개인사용") { ds.perKm += km; ds.perToll += tol; }
    else                     { ds.bizKm += km; ds.bizToll += tol; }

    let vs = ds.vehicles.find(v => v.vehicle_id === vid);
    if (!vs) { vs = { vehicle_id: vid, plate_number: plate, model, bizKm: 0, bizToll: 0, comKm: 0, comToll: 0, perKm: 0, perToll: 0, totalKm: 0, tripCount: 0 }; ds.vehicles.push(vs); }
    vs.totalKm += km; vs.tripCount += 1;
    if (type === "출퇴근")   { vs.comKm += km; vs.comToll += tol; }
    else if (type === "개인사용") { vs.perKm += km; vs.perToll += tol; }
    else                     { vs.bizKm += km; vs.bizToll += tol; }
  });

  const rows = Object.values(driverMap).sort((a, b) => b.totalKm - a.totalKm);

  // ── Excel 생성 ──────────────────────────────────────────────
  const monthLabel = `${year}년 ${String(month).padStart(2, "0")}월`;
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  const cell = (v: any, t: "s" | "n", style: any): XLSX.CellObject => ({ v, t, s: style });
  const R = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

  const titleStyle   = { font: { bold: true, sz: 13, color: { rgb: "1F2937" } }, alignment: { horizontal: "left", vertical: "center" } };
  const subStyle     = { font: { sz: 10, color: { rgb: "6B7280" } }, alignment: { horizontal: "left", vertical: "center" } };
  const hBiz  = { font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1E3A5F" }, patternType: "solid" }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: { top: { style: "thin", color: { rgb: "FFFFFF" } }, bottom: { style: "thin", color: { rgb: "FFFFFF" } }, left: { style: "thin", color: { rgb: "FFFFFF" } }, right: { style: "thin", color: { rgb: "FFFFFF" } } } };
  const hCom  = { font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "065F46" }, patternType: "solid" }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: { top: { style: "thin", color: { rgb: "FFFFFF" } }, bottom: { style: "thin", color: { rgb: "FFFFFF" } }, left: { style: "thin", color: { rgb: "FFFFFF" } }, right: { style: "thin", color: { rgb: "FFFFFF" } } } };
  const hPer  = { font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "9A3412" }, patternType: "solid" }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: { top: { style: "thin", color: { rgb: "FFFFFF" } }, bottom: { style: "thin", color: { rgb: "FFFFFF" } }, left: { style: "thin", color: { rgb: "FFFFFF" } }, right: { style: "thin", color: { rgb: "FFFFFF" } } } };
  const hTot  = { font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "374151" }, patternType: "solid" }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin", color: { rgb: "FFFFFF" } }, bottom: { style: "thin", color: { rgb: "FFFFFF" } }, left: { style: "thin", color: { rgb: "FFFFFF" } }, right: { style: "thin", color: { rgb: "FFFFFF" } } } };
  const dataStyle    = { font: { sz: 10 }, alignment: { horizontal: "left", vertical: "center" }, border: { top: { style: "thin", color: { rgb: "E5E7EB" } }, bottom: { style: "thin", color: { rgb: "E5E7EB" } }, left: { style: "thin", color: { rgb: "E5E7EB" } }, right: { style: "thin", color: { rgb: "E5E7EB" } } } };
  const numStyle     = { font: { sz: 10 }, alignment: { horizontal: "right", vertical: "center" }, border: { top: { style: "thin", color: { rgb: "E5E7EB" } }, bottom: { style: "thin", color: { rgb: "E5E7EB" } }, left: { style: "thin", color: { rgb: "E5E7EB" } }, right: { style: "thin", color: { rgb: "E5E7EB" } } } };
  const numCom       = { ...numStyle, font: { sz: 10, color: { rgb: "065F46" } } };
  const numPer       = { ...numStyle, font: { sz: 10, color: { rgb: "9A3412" } } };
  const numBold      = { ...numStyle, font: { bold: true, sz: 10 } };
  const subDataStyle = { font: { sz: 9, color: { rgb: "6B7280" } }, alignment: { horizontal: "left", vertical: "center" }, fill: { fgColor: { rgb: "F9FAFB" }, patternType: "solid" }, border: { top: { style: "thin", color: { rgb: "E5E7EB" } }, bottom: { style: "thin", color: { rgb: "E5E7EB" } }, left: { style: "thin", color: { rgb: "E5E7EB" } }, right: { style: "thin", color: { rgb: "E5E7EB" } } } };
  const subNumStyle  = { font: { sz: 9, color: { rgb: "6B7280" } }, alignment: { horizontal: "right", vertical: "center" }, fill: { fgColor: { rgb: "F9FAFB" }, patternType: "solid" }, border: { top: { style: "thin", color: { rgb: "E5E7EB" } }, bottom: { style: "thin", color: { rgb: "E5E7EB" } }, left: { style: "thin", color: { rgb: "E5E7EB" } }, right: { style: "thin", color: { rgb: "E5E7EB" } } } };
  const footerStyle  = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: "F3F4F6" }, patternType: "solid" }, alignment: { horizontal: "right", vertical: "center" }, border: { top: { style: "medium", color: { rgb: "9CA3AF" } }, bottom: { style: "medium", color: { rgb: "9CA3AF" } }, left: { style: "thin", color: { rgb: "E5E7EB" } }, right: { style: "thin", color: { rgb: "E5E7EB" } } } };
  const footerLabel  = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: "F3F4F6" }, patternType: "solid" }, alignment: { horizontal: "left", vertical: "center" }, border: { top: { style: "medium", color: { rgb: "9CA3AF" } }, bottom: { style: "medium", color: { rgb: "9CA3AF" } }, left: { style: "thin", color: { rgb: "E5E7EB" } }, right: { style: "thin", color: { rgb: "E5E7EB" } } } };

  // 제목
  ws[R(0, 0)] = cell(`${monthLabel} 운전자별 운행 집계`, "s", titleStyle);
  ws[R(1, 0)] = cell(COMPANY_NAME, "s", subStyle);

  // 헤더 (Row 3) — 11 컬럼
  const COLS = 11;
  const headerCells = [
    { v: "운전자",       s: hBiz },
    { v: "차량",         s: hBiz },
    { v: "업무 km",      s: hBiz },
    { v: "업무 통행료",  s: hBiz },
    { v: "출퇴근 km",    s: hCom },
    { v: "통행료(출퇴근)", s: hCom },
    { v: "개인 km",      s: hPer },
    { v: "통행료(개인)", s: hPer },
    { v: "건수",         s: hTot },
    { v: "합계 km",      s: hTot },
  ];
  headerCells.forEach((h, c) => { ws[R(3, c)] = cell(h.v, "s", h.s); });

  let curRow = 4;
  const rowHeights: { hpt: number }[] = [{ hpt: 24 }, { hpt: 16 }, { hpt: 8 }, { hpt: 22 }];

  rows.forEach(driver => {
    const multiVehicle = driver.vehicles.length > 1;

    // 운전자 집계 행
    ws[R(curRow, 0)] = cell(driver.driver_name, "s", dataStyle);
    ws[R(curRow, 1)] = cell(multiVehicle ? `${driver.vehicles.length}개 차량` : (driver.vehicles[0]?.plate_number ?? "—"), "s", dataStyle);
    ws[R(curRow, 2)] = { v: driver.bizKm,   t: "n", s: numStyle, z: "#,##0" };
    ws[R(curRow, 3)] = { v: driver.bizToll, t: "n", s: numStyle, z: "#,##0" };
    ws[R(curRow, 4)] = { v: driver.comKm,   t: "n", s: numCom,   z: "#,##0" };
    ws[R(curRow, 5)] = { v: driver.comToll, t: "n", s: numCom,   z: "#,##0" };
    ws[R(curRow, 6)] = { v: driver.perKm,   t: "n", s: numPer,   z: "#,##0" };
    ws[R(curRow, 7)] = { v: driver.perToll, t: "n", s: numPer,   z: "#,##0" };
    ws[R(curRow, 8)] = { v: driver.tripCount, t: "n", s: numStyle, z: "#,##0" };
    ws[R(curRow, 9)] = { v: driver.totalKm, t: "n", s: numBold,  z: "#,##0" };
    rowHeights.push({ hpt: 20 });
    curRow += 1;

    // 복수 차량이면 차량별 세부 행 삽입
    if (multiVehicle) {
      driver.vehicles.forEach(v => {
        ws[R(curRow, 0)] = cell("", "s", subDataStyle);
        ws[R(curRow, 1)] = cell(`  └ ${v.plate_number} (${v.model})`, "s", subDataStyle);
        ws[R(curRow, 2)] = { v: v.bizKm,   t: "n", s: subNumStyle, z: "#,##0" };
        ws[R(curRow, 3)] = { v: v.bizToll, t: "n", s: subNumStyle, z: "#,##0" };
        ws[R(curRow, 4)] = { v: v.comKm,   t: "n", s: subNumStyle, z: "#,##0" };
        ws[R(curRow, 5)] = { v: v.comToll, t: "n", s: subNumStyle, z: "#,##0" };
        ws[R(curRow, 6)] = { v: v.perKm,   t: "n", s: subNumStyle, z: "#,##0" };
        ws[R(curRow, 7)] = { v: v.perToll, t: "n", s: subNumStyle, z: "#,##0" };
        ws[R(curRow, 8)] = { v: v.tripCount, t: "n", s: subNumStyle, z: "#,##0" };
        ws[R(curRow, 9)] = { v: v.totalKm, t: "n", s: subNumStyle, z: "#,##0" };
        rowHeights.push({ hpt: 17 });
        curRow += 1;
      });
    }
  });

  // 합계 행
  ws[R(curRow, 0)] = cell("합계", "s", footerLabel);
  ws[R(curRow, 1)] = cell("",    "s", footerLabel);
  ws[R(curRow, 2)] = { v: rows.reduce((s, r) => s + r.bizKm,    0), t: "n", s: footerStyle, z: "#,##0" };
  ws[R(curRow, 3)] = { v: rows.reduce((s, r) => s + r.bizToll,  0), t: "n", s: footerStyle, z: "#,##0" };
  ws[R(curRow, 4)] = { v: rows.reduce((s, r) => s + r.comKm,    0), t: "n", s: footerStyle, z: "#,##0" };
  ws[R(curRow, 5)] = { v: rows.reduce((s, r) => s + r.comToll,  0), t: "n", s: footerStyle, z: "#,##0" };
  ws[R(curRow, 6)] = { v: rows.reduce((s, r) => s + r.perKm,    0), t: "n", s: footerStyle, z: "#,##0" };
  ws[R(curRow, 7)] = { v: rows.reduce((s, r) => s + r.perToll,  0), t: "n", s: footerStyle, z: "#,##0" };
  ws[R(curRow, 8)] = { v: rows.reduce((s, r) => s + r.tripCount,0), t: "n", s: footerStyle, z: "#,##0" };
  ws[R(curRow, 9)] = { v: rows.reduce((s, r) => s + r.totalKm,  0), t: "n", s: footerStyle, z: "#,##0" };
  rowHeights.push({ hpt: 22 });

  ws["!ref"]  = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: curRow, c: COLS - 1 } });
  ws["!cols"] = [
    { wch: 12 }, // 운전자
    { wch: 20 }, // 차량
    { wch: 12 }, // 업무 km
    { wch: 14 }, // 업무 통행료
    { wch: 12 }, // 출퇴근 km
    { wch: 16 }, // 통행료(출퇴근)
    { wch: 12 }, // 개인 km
    { wch: 14 }, // 통행료(개인)
    { wch: 8  }, // 건수
    { wch: 12 }, // 합계 km
  ];
  ws["!rows"] = rowHeights;
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: COLS - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: COLS - 1 } },
    { s: { r: curRow, c: 0 }, e: { r: curRow, c: 1 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, `${month}월 운전자별집계`);

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellStyles: true });
  const fileName    = `운전자별운행집계_${year}년${String(month).padStart(2, "0")}월.xlsx`;
  const encodedName = encodeURIComponent(fileName);

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
    },
  });
}
