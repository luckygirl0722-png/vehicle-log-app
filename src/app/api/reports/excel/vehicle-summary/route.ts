import { NextRequest, NextResponse } from "next/server";
import { withAuth, badReq, serverErr } from "@/lib/api/auth-guard";
import * as XLSX from "xlsx";

const COMPANY_NAME = "삼우에레코주식회사";

/**
 * GET /api/reports/excel/vehicle-summary
 * 화면의 "차량별 운행 집계" 테이블과 동일한 형식의 Excel 생성
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

  // 활성 차량 목록
  const { data: vehicles, error: vErr } = await supabase!
    .from("vehicles")
    .select("id, plate_number, model")
    .eq("is_active", true)
    .order("plate_number");
  if (vErr) return serverErr(vErr.message);

  // 해당 월 운행 기록 (trip_type, distance_km, toll_fee)
  const { data: trips, error: tErr } = await supabase!
    .from("trip_logs")
    .select("vehicle_id, distance_km, toll_fee, trip_type")
    .gte("departure_time", from)
    .lt("departure_time", to)
    .not("arrival_time", "is", null);
  if (tErr) return serverErr(tErr.message);

  // 차량별 집계
  type Row = {
    plate_number: string;
    model: string;
    bizKm: number;
    bizToll: number;
    comKm: number;
    comToll: number;
    totalKm: number;
  };

  const statsMap: Record<string, Row> = {};
  vehicles?.forEach(v => {
    statsMap[v.id] = {
      plate_number: v.plate_number,
      model: v.model,
      bizKm: 0, bizToll: 0,
      comKm: 0, comToll: 0,
      totalKm: 0,
    };
  });

  trips?.forEach(t => {
    if (!t.vehicle_id || !statsMap[t.vehicle_id]) return;
    const s   = statsMap[t.vehicle_id];
    const km  = t.distance_km ?? 0;
    const tol = t.toll_fee ?? 0;
    s.totalKm += km;
    if (t.trip_type === "출퇴근") { s.comKm += km; s.comToll += tol; }
    else                          { s.bizKm += km; s.bizToll += tol; }
  });

  const rows = Object.values(statsMap).filter(r => r.totalKm > 0);

  if (!rows.length) return badReq("해당 기간에 운행 기록이 없습니다.");

  // ── Excel 생성 ──────────────────────────────────────────────
  const monthLabel = `${year}년 ${String(month).padStart(2, "0")}월`;
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  // 스타일 헬퍼
  const cell = (v: any, t: "s" | "n", style: any): XLSX.CellObject => ({ v, t, s: style });

  const titleStyle = {
    font: { bold: true, sz: 13, color: { rgb: "1F2937" } },
    alignment: { horizontal: "left", vertical: "center" },
  };
  const subStyle = {
    font: { sz: 10, color: { rgb: "6B7280" } },
    alignment: { horizontal: "left", vertical: "center" },
  };
  const headerStyleBiz = {
    font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1E3A5F" }, patternType: "solid" },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: { top: { style: "thin", color: { rgb: "FFFFFF" } }, bottom: { style: "thin", color: { rgb: "FFFFFF" } }, left: { style: "thin", color: { rgb: "FFFFFF" } }, right: { style: "thin", color: { rgb: "FFFFFF" } } },
  };
  const headerStyleCom = {
    font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "065F46" }, patternType: "solid" },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: { top: { style: "thin", color: { rgb: "FFFFFF" } }, bottom: { style: "thin", color: { rgb: "FFFFFF" } }, left: { style: "thin", color: { rgb: "FFFFFF" } }, right: { style: "thin", color: { rgb: "FFFFFF" } } },
  };
  const headerStyleTotal = {
    font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "374151" }, patternType: "solid" },
    alignment: { horizontal: "center", vertical: "center" },
    border: { top: { style: "thin", color: { rgb: "FFFFFF" } }, bottom: { style: "thin", color: { rgb: "FFFFFF" } }, left: { style: "thin", color: { rgb: "FFFFFF" } }, right: { style: "thin", color: { rgb: "FFFFFF" } } },
  };
  const dataStyle = {
    font: { sz: 10 },
    alignment: { horizontal: "left", vertical: "center" },
    border: { top: { style: "thin", color: { rgb: "E5E7EB" } }, bottom: { style: "thin", color: { rgb: "E5E7EB" } }, left: { style: "thin", color: { rgb: "E5E7EB" } }, right: { style: "thin", color: { rgb: "E5E7EB" } } },
  };
  const numStyle = {
    font: { sz: 10 },
    alignment: { horizontal: "right", vertical: "center" },
    border: { top: { style: "thin", color: { rgb: "E5E7EB" } }, bottom: { style: "thin", color: { rgb: "E5E7EB" } }, left: { style: "thin", color: { rgb: "E5E7EB" } }, right: { style: "thin", color: { rgb: "E5E7EB" } } },
    numFmt: "#,##0",
  };
  const numStyleCom = {
    ...numStyle,
    font: { sz: 10, color: { rgb: "065F46" } },
  };
  const numStyleBold = {
    ...numStyle,
    font: { bold: true, sz: 10 },
  };
  const footerStyle = {
    font: { bold: true, sz: 10, color: { rgb: "1F2937" } },
    fill: { fgColor: { rgb: "F3F4F6" }, patternType: "solid" },
    alignment: { horizontal: "right", vertical: "center" },
    border: { top: { style: "medium", color: { rgb: "9CA3AF" } }, bottom: { style: "medium", color: { rgb: "9CA3AF" } }, left: { style: "thin", color: { rgb: "E5E7EB" } }, right: { style: "thin", color: { rgb: "E5E7EB" } } },
    numFmt: "#,##0",
  };
  const footerLabelStyle = {
    font: { bold: true, sz: 10 },
    fill: { fgColor: { rgb: "F3F4F6" }, patternType: "solid" },
    alignment: { horizontal: "left", vertical: "center" },
    border: { top: { style: "medium", color: { rgb: "9CA3AF" } }, bottom: { style: "medium", color: { rgb: "9CA3AF" } }, left: { style: "thin", color: { rgb: "E5E7EB" } }, right: { style: "thin", color: { rgb: "E5E7EB" } } },
  };

  // 좌표 헬퍼
  const R = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

  // Row 0: 제목
  ws[R(0, 0)] = cell(`${monthLabel} 차량별 운행 집계`, "s", titleStyle);
  ws[R(1, 0)] = cell(COMPANY_NAME, "s", subStyle);

  // Row 2: 빈 줄

  // Row 3: 헤더
  const headers = [
    { v: "차량번호",     style: headerStyleBiz },
    { v: "차량명",       style: headerStyleBiz },
    { v: "업무 km",      style: headerStyleBiz },
    { v: "업무 통행료",  style: headerStyleBiz },
    { v: "출퇴근 km",    style: headerStyleCom },
    { v: "통행료(개인)", style: headerStyleCom },
    { v: "합계 km",      style: headerStyleTotal },
  ];
  headers.forEach((h, c) => {
    ws[R(3, c)] = cell(h.v, "s", h.style);
  });

  // Row 4~: 데이터
  rows.forEach((r, i) => {
    const row = 4 + i;
    ws[R(row, 0)] = cell(r.plate_number, "s", dataStyle);
    ws[R(row, 1)] = cell(r.model,        "s", dataStyle);
    ws[R(row, 2)] = { v: r.bizKm,   t: "n", s: numStyle,    z: "#,##0" };
    ws[R(row, 3)] = { v: r.bizToll, t: "n", s: numStyle,    z: "#,##0" };
    ws[R(row, 4)] = { v: r.comKm,   t: "n", s: numStyleCom, z: "#,##0" };
    ws[R(row, 5)] = { v: r.comToll, t: "n", s: numStyleCom, z: "#,##0" };
    ws[R(row, 6)] = { v: r.totalKm, t: "n", s: numStyleBold, z: "#,##0" };
  });

  // 합계 행
  const footerRow = 4 + rows.length;
  ws[R(footerRow, 0)] = cell("합계", "s", footerLabelStyle);
  ws[R(footerRow, 1)] = cell("", "s", footerLabelStyle);
  ws[R(footerRow, 2)] = { v: rows.reduce((s, r) => s + r.bizKm,   0), t: "n", s: footerStyle, z: "#,##0" };
  ws[R(footerRow, 3)] = { v: rows.reduce((s, r) => s + r.bizToll, 0), t: "n", s: footerStyle, z: "#,##0" };
  ws[R(footerRow, 4)] = { v: rows.reduce((s, r) => s + r.comKm,   0), t: "n", s: footerStyle, z: "#,##0" };
  ws[R(footerRow, 5)] = { v: rows.reduce((s, r) => s + r.comToll, 0), t: "n", s: footerStyle, z: "#,##0" };
  ws[R(footerRow, 6)] = { v: rows.reduce((s, r) => s + r.totalKm, 0), t: "n", s: footerStyle, z: "#,##0" };

  // 범위 설정
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: footerRow, c: 6 } });

  // 열 너비
  ws["!cols"] = [
    { wch: 14 }, // 차량번호
    { wch: 12 }, // 차량명
    { wch: 12 }, // 업무 km
    { wch: 14 }, // 업무 통행료
    { wch: 12 }, // 출퇴근 km
    { wch: 14 }, // 통행료(개인)
    { wch: 12 }, // 합계 km
  ];

  // 행 높이
  ws["!rows"] = [
    { hpt: 24 }, // 제목
    { hpt: 16 }, // 부제
    { hpt: 8  }, // 빈 줄
    { hpt: 22 }, // 헤더
    ...rows.map(() => ({ hpt: 20 })),
    { hpt: 22 }, // 합계
  ];

  // 제목 병합
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
    { s: { r: footerRow, c: 0 }, e: { r: footerRow, c: 1 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, `${month}월 차량별집계`);

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellStyles: true });

  const fileName   = `차량별운행집계_${year}년${String(month).padStart(2, "0")}월.xlsx`;
  const encodedName = encodeURIComponent(fileName);

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
    },
  });
}
