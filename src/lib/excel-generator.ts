import * as XLSX from "xlsx";

/** 운행일지 데이터 타입 */
export interface TripRowData {
  no:                 number;
  date:               string;   // 예: 2026-06-05
  departure_time:     string;   // 예: 09:00
  arrival_time:       string;   // 예: 11:30
  driver_name:        string;
  vehicle_plate:      string;
  departure_location: string;
  arrival_location:   string;
  departure_km:       number;
  arrival_km:         number;
  distance_km:        number;
  purpose:            string;
  toll_fee:           number;
  note:               string;
}

/** 차량별 집계 타입 */
export interface VehicleSummary {
  plate_number:   string;
  model:          string;
  trip_count:     number;
  total_distance: number;
  total_toll:     number;
}

export interface GenerateExcelOptions {
  year:         number;
  month:        number;
  companyName:  string;
  trips:        TripRowData[];
  summaries:    VehicleSummary[];
}

/** 열 너비 설정 헬퍼 */
function colWidths(widths: number[]) {
  return widths.map(w => ({ wch: w }));
}

/** 헤더 스타일 (굵게, 가운데 정렬, 배경색) */
const HEADER_STYLE = {
  font:      { bold: true, sz: 10 },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  fill:      { fgColor: { rgb: "1F4E79" }, patternType: "solid" },
  border: {
    top:    { style: "thin", color: { rgb: "CCCCCC" } },
    bottom: { style: "thin", color: { rgb: "CCCCCC" } },
    left:   { style: "thin", color: { rgb: "CCCCCC" } },
    right:  { style: "thin", color: { rgb: "CCCCCC" } },
  },
};

const DATA_BORDER = {
  top:    { style: "thin", color: { rgb: "DDDDDD" } },
  bottom: { style: "thin", color: { rgb: "DDDDDD" } },
  left:   { style: "thin", color: { rgb: "DDDDDD" } },
  right:  { style: "thin", color: { rgb: "DDDDDD" } },
};

/**
 * 차량운행일지 Excel 파일 생성
 * Sheet1: 운행 상세 기록
 * Sheet2: 차량별 월간 집계
 */
export function generateTripLogExcel(options: GenerateExcelOptions): Buffer {
  const { year, month, companyName, trips, summaries } = options;
  const monthLabel = `${year}년 ${String(month).padStart(2, "0")}월`;
  const wb = XLSX.utils.book_new();

  // ─────────────────────────────────────────────────────────
  // Sheet 1: 차량운행일지 (상세 기록)
  // ─────────────────────────────────────────────────────────
  const sh1Data: any[][] = [];

  // 제목 행
  sh1Data.push([`차량 운행일지 — ${companyName}`, "", "", "", "", "", "", "", "", "", "", "", "", ""]);
  sh1Data.push([`기간: ${monthLabel}`, "", "", "", "", "", "", "", "", "", "", "", "", ""]);
  sh1Data.push([]); // 빈 행

  // 헤더
  sh1Data.push([
    "번호", "날짜", "출발시각", "도착시각",
    "운전자", "차량번호",
    "출발지", "목적지",
    "출발km", "도착km", "운행거리(km)",
    "업무목적", "통행료(원)", "비고",
  ]);

  // 데이터 행
  trips.forEach(t => {
    sh1Data.push([
      t.no,
      t.date,
      t.departure_time,
      t.arrival_time,
      t.driver_name,
      t.vehicle_plate,
      t.departure_location,
      t.arrival_location,
      t.departure_km,
      t.arrival_km,
      t.distance_km,
      t.purpose,
      t.toll_fee,
      t.note,
    ]);
  });

  // 합계 행
  const dataStartRow = 5; // 1-indexed, 헤더가 4행
  const dataEndRow   = dataStartRow + trips.length - 1;
  sh1Data.push([
    "합계", "", "", "", `${trips.length}건`, "",
    "", "",
    "", "",
    trips.reduce((s, t) => s + t.distance_km, 0),
    "", trips.reduce((s, t) => s + t.toll_fee, 0), "",
  ]);

  const ws1 = XLSX.utils.aoa_to_sheet(sh1Data);

  // 열 너비
  ws1["!cols"] = colWidths([6, 12, 10, 10, 10, 12, 20, 20, 10, 10, 14, 18, 14, 16]);

  // 행 높이 (헤더)
  ws1["!rows"] = [
    { hpt: 24 }, { hpt: 18 }, { hpt: 6 }, { hpt: 32 },
    ...Array(trips.length + 1).fill({ hpt: 18 }),
  ];

  // 셀 병합 (제목)
  ws1["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 13 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 13 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws1, "차량운행일지");

  // ─────────────────────────────────────────────────────────
  // Sheet 2: 차량별 월간 집계
  // ─────────────────────────────────────────────────────────
  const sh2Data: any[][] = [];
  sh2Data.push([`차량별 운행 집계 — ${monthLabel}`, "", "", "", ""]);
  sh2Data.push([]);
  sh2Data.push(["차량번호", "차종", "운행 건수", "총 운행거리(km)", "총 통행료(원)"]);

  summaries.forEach(s => {
    sh2Data.push([
      s.plate_number,
      s.model,
      s.trip_count,
      s.total_distance,
      s.total_toll,
    ]);
  });

  sh2Data.push([
    "합계", "",
    summaries.reduce((s, v) => s + v.trip_count, 0),
    summaries.reduce((s, v) => s + v.total_distance, 0),
    summaries.reduce((s, v) => s + v.total_toll, 0),
  ]);

  const ws2 = XLSX.utils.aoa_to_sheet(sh2Data);
  ws2["!cols"] = colWidths([14, 16, 12, 18, 16]);
  ws2["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

  XLSX.utils.book_append_sheet(wb, ws2, "차량별집계");

  // Buffer로 변환
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}

/**
 * 파일명 생성 헬퍼
 * 예: "차량운행일지_2026년06월_12가3456.xlsx"
 *     "차량운행일지_2026년06월_전체.xlsx"
 */
export function buildExcelFileName(year: number, month: number, plate?: string): string {
  const monthStr = String(month).padStart(2, "0");
  const suffix   = plate ?? "전체";
  return `차량운행일지_${year}년${monthStr}월_${suffix}.xlsx`;
}
