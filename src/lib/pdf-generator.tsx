import React from "react";
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer, Font,
} from "@react-pdf/renderer";

// ── 폰트 등록 (Noto Sans KR) ─────────────────────────────────
// 서버사이드에서 실행되므로 public 폴더 내 폰트를 사용
// 폰트 파일은 public/fonts/NotoSansKR-*.ttf 에 배치 필요
// 없으면 기본 Helvetica 폰트로 fallback
const FONT_FAMILY = "NotoSansKR";

try {
  Font.register({
    family: FONT_FAMILY,
    fonts: [
      { src: "./public/fonts/NotoSansKR-Regular.ttf",  fontWeight: 400 },
      { src: "./public/fonts/NotoSansKR-Medium.ttf",   fontWeight: 500 },
      { src: "./public/fonts/NotoSansKR-Bold.ttf",     fontWeight: 700 },
    ],
  });
} catch {
  // 폰트 없으면 무시 — 기본 폰트 사용
}

// ── 브랜드 컬러 ──────────────────────────────────────────────
const NAVY  = "#1F4E79";
const GRAY  = "#6B7280";
const LGRAY = "#F3F4F6";
const BLACK = "#111827";
const WHITE = "#FFFFFF";

// ── 스타일 ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    color: BLACK,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
  },

  // ── 헤더 ──
  headerBox: {
    backgroundColor: NAVY,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    borderRadius: 4,
  },
  companyName: { color: WHITE, fontSize: 8, marginBottom: 4, opacity: 0.8 },
  reportTitle: { color: WHITE, fontSize: 16, fontWeight: 700 },
  reportMeta:  { color: WHITE, fontSize: 8,  marginTop: 4, opacity: 0.8 },

  // ── 정보 카드 ──
  infoRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  infoCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
    padding: 8,
  },
  infoLabel: { fontSize: 7, color: GRAY, marginBottom: 3 },
  infoValue: { fontSize: 9,  fontWeight: 700, color: BLACK },

  // ── 테이블 ──
  tableTitle: { fontSize: 10, fontWeight: 700, marginBottom: 6, color: NAVY },
  table: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 4, overflow: "hidden" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: NAVY,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    color: WHITE,
    fontSize: 7.5,
    fontWeight: 700,
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  tableRowAlt: { backgroundColor: LGRAY },
  tableCell: { fontSize: 8, textAlign: "center", color: BLACK },

  // ── 합계 행 ──
  totalRow: {
    flexDirection: "row",
    backgroundColor: "#EFF6FF",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: "#BFDBFE",
  },
  totalCell: { fontSize: 8, fontWeight: 700, color: NAVY, textAlign: "center" },

  // ── 서명란 ──
  signatureSection: { marginTop: 20 },
  signatureTitle: { fontSize: 9, fontWeight: 700, marginBottom: 10, color: NAVY },
  signatureRow: { flexDirection: "row", gap: 16 },
  signatureBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
    padding: 10,
    minHeight: 56,
  },
  signatureLabel: { fontSize: 7.5, color: GRAY, marginBottom: 16 },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#9CA3AF",
    marginTop: 8,
  },
  signatureSubLabel: { fontSize: 7, color: GRAY, marginTop: 3, textAlign: "right" },

  // ── 푸터 ──
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: GRAY },
});

// ── 컬럼 너비 (flex 비율) ──────────────────────────────────────
const COL = {
  no:    "4%",
  date:  "9%",
  dep:   "8%",
  arr:   "8%",
  driver:"9%",
  veh:   "9%",
  from:  "14%",
  to:    "14%",
  km:    "7%",
  dist:  "8%",
  purpose:"10%",
  toll:   "8%",  // (합계 = 108%, 약간 초과하면 wrap)
};

export interface PdfTripRow {
  no:                 number;
  date:               string;
  departure_time:     string;
  arrival_time:       string;
  driver_name:        string;
  vehicle_plate:      string;
  departure_location: string;
  arrival_location:   string;
  distance_km:        number;
  purpose:            string;
  toll_fee:           number;
}

export interface PdfReportOptions {
  companyName:  string;
  year:         number;
  month:        number;
  vehiclePlate: string | null;  // null = 전체
  trips:        PdfTripRow[];
  totalDistance: number;
  totalToll:    number;
}

// ── PDF 문서 컴포넌트 ────────────────────────────────────────
function TripLogPdf({ opts }: { opts: PdfReportOptions }) {
  const { companyName, year, month, vehiclePlate, trips, totalDistance, totalToll } = opts;
  const monthStr = String(month).padStart(2, "0");
  const title    = vehiclePlate
    ? `차량 운행일지 (${vehiclePlate})`
    : "차량 운행일지 (전체)";

  const now      = new Date();
  const printDate = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,"0")}.${String(now.getDate()).padStart(2,"0")}`;

  const headers = [
    { label: "번호",    width: COL.no },
    { label: "날짜",    width: COL.date },
    { label: "출발",    width: COL.dep },
    { label: "도착",    width: COL.arr },
    { label: "운전자",  width: COL.driver },
    { label: "차량",    width: COL.veh },
    { label: "출발지",  width: COL.from },
    { label: "목적지",  width: COL.to },
    { label: "거리(km)",width: COL.km },
    { label: "업무목적",width: COL.purpose },
    { label: "통행료",  width: COL.toll },
  ];

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>

        {/* 헤더 */}
        <View style={styles.headerBox}>
          <Text style={styles.companyName}>{companyName}</Text>
          <Text style={styles.reportTitle}>{title}</Text>
          <Text style={styles.reportMeta}>기간: {year}년 {monthStr}월</Text>
        </View>

        {/* 요약 카드 */}
        <View style={styles.infoRow}>
          {[
            { label: "운행 건수",    value: `${trips.length}건` },
            { label: "총 운행거리",  value: `${totalDistance.toLocaleString("ko-KR")} km` },
            { label: "총 통행료",    value: `${totalToll.toLocaleString("ko-KR")}원` },
            { label: "출력 기준",    value: `${year}.${monthStr} 승인/제출 기록` },
          ].map(({ label, value }) => (
            <View key={label} style={styles.infoCard}>
              <Text style={styles.infoLabel}>{label}</Text>
              <Text style={styles.infoValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* 운행 상세 테이블 */}
        <Text style={styles.tableTitle}>운행 상세 기록</Text>
        <View style={styles.table}>
          {/* 헤더 */}
          <View style={styles.tableHeader}>
            {headers.map(h => (
              <Text key={h.label} style={[styles.tableHeaderCell, { width: h.width }]}>
                {h.label}
              </Text>
            ))}
          </View>

          {/* 데이터 행 */}
          {trips.map((t, i) => (
            <View key={t.no} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={[styles.tableCell, { width: COL.no }]}>{t.no}</Text>
              <Text style={[styles.tableCell, { width: COL.date }]}>{t.date}</Text>
              <Text style={[styles.tableCell, { width: COL.dep }]}>{t.departure_time}</Text>
              <Text style={[styles.tableCell, { width: COL.arr }]}>{t.arrival_time}</Text>
              <Text style={[styles.tableCell, { width: COL.driver }]}>{t.driver_name}</Text>
              <Text style={[styles.tableCell, { width: COL.veh }]}>{t.vehicle_plate}</Text>
              <Text style={[styles.tableCell, { width: COL.from, textAlign: "left" }]}>{t.departure_location}</Text>
              <Text style={[styles.tableCell, { width: COL.to,   textAlign: "left" }]}>{t.arrival_location}</Text>
              <Text style={[styles.tableCell, { width: COL.km }]}>{t.distance_km.toLocaleString("ko-KR")}</Text>
              <Text style={[styles.tableCell, { width: COL.purpose, textAlign: "left" }]}>{t.purpose}</Text>
              <Text style={[styles.tableCell, { width: COL.toll }]}>
                {t.toll_fee > 0 ? t.toll_fee.toLocaleString("ko-KR") : "—"}
              </Text>
            </View>
          ))}

          {/* 합계 행 */}
          <View style={styles.totalRow}>
            <Text style={[styles.totalCell, { width: COL.no }]}>—</Text>
            <Text style={[styles.totalCell, { width: COL.date }]}>합계</Text>
            <Text style={[styles.totalCell, { width: COL.dep }]}></Text>
            <Text style={[styles.totalCell, { width: COL.arr }]}></Text>
            <Text style={[styles.totalCell, { width: COL.driver }]}>{trips.length}건</Text>
            <Text style={[styles.totalCell, { width: COL.veh }]}></Text>
            <Text style={[styles.totalCell, { width: COL.from }]}></Text>
            <Text style={[styles.totalCell, { width: COL.to }]}></Text>
            <Text style={[styles.totalCell, { width: COL.km }]}>
              {totalDistance.toLocaleString("ko-KR")}
            </Text>
            <Text style={[styles.totalCell, { width: COL.purpose }]}></Text>
            <Text style={[styles.totalCell, { width: COL.toll }]}>
              {totalToll.toLocaleString("ko-KR")}
            </Text>
          </View>
        </View>

        {/* 서명란 */}
        <View style={styles.signatureSection}>
          <Text style={styles.signatureTitle}>확인 서명</Text>
          <View style={styles.signatureRow}>
            {["작성자", "검토자", "승인자"].map(role => (
              <View key={role} style={styles.signatureBox}>
                <Text style={styles.signatureLabel}>{role}</Text>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureSubLabel}>(서명)</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 푸터 */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{companyName} — 차량 운행일지</Text>
          <Text style={styles.footerText}>출력일: {printDate}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          } />
        </View>

      </Page>
    </Document>
  );
}

/**
 * PDF Buffer 생성 (서버사이드)
 */
export async function generateTripLogPdf(opts: PdfReportOptions): Promise<Buffer> {
  const buf = await renderToBuffer(<TripLogPdf opts={opts} />);
  return Buffer.from(buf);
}

/**
 * PDF 파일명 생성
 * 예: "차량운행일지_2026년06월_12가3456.pdf"
 */
export function buildPdfFileName(year: number, month: number, plate?: string): string {
  const monthStr = String(month).padStart(2, "0");
  const suffix   = plate ?? "전체";
  return `차량운행일지_${year}년${monthStr}월_${suffix}.pdf`;
}
