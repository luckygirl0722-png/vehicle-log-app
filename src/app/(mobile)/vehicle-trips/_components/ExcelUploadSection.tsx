"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

interface ParsedRow {
  rowNum:             number;
  date:               string;
  dep_time:           string;
  arr_time:           string;
  dep_loc:            string;
  arr_loc:            string;
  dep_km:             number;
  arr_km:             number;
  distance:           number;
  trip_type:          string;
  purpose:            string;
  toll_fee:           number;
  note:               string;
  error?:             string;
}

interface Props {
  vehicleId:   string;
  vehiclePlate: string;
}

const VALID_TYPES = ["업무", "출퇴근", "개인사용"];

// 엑셀 날짜 직렬번호 → "YYYY-MM-DD" 변환
function excelDateToStr(val: unknown): string {
  if (typeof val === "number" && val > 0) {
    // 엑셀 날짜 직렬번호: 1900-01-01 = 1, 단 엑셀의 윤년 버그로 60을 뺀 뒤 계산
    const epoch = (val - 25569) * 86400 * 1000;
    const d = new Date(epoch);
    const year  = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day   = String(d.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (val instanceof Date) {
    const year  = val.getUTCFullYear();
    const month = String(val.getUTCMonth() + 1).padStart(2, "0");
    const day   = String(val.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const s = String(val ?? "").trim();
  // "6/1(월)" 또는 "6/1" 형식 처리
  const matched = s.match(/(\d{1,2})\/(\d{1,2})/);
  if (matched) {
    const year = new Date().getFullYear();
    return `${year}-${String(matched[1]).padStart(2, "0")}-${String(matched[2]).padStart(2, "0")}`;
  }
  return s;
}

function toTimeStr(val: unknown): string {
  const s = String(val ?? "").trim();
  if (!s) return "";
  // "08:30" 형식 그대로 허용
  if (/^\d{1,2}:\d{2}$/.test(s)) return s.padStart(5, "0");
  return s;
}

function toNumber(val: unknown): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export default function ExcelUploadSection({ vehicleId, vehiclePlate }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep]           = useState<"idle" | "preview" | "done">("idle");
  const [rows, setRows]           = useState<ParsedRow[]>([]);
  const [fileName, setFileName]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<string | null>(null);
  const [apiError, setApiError]   = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setApiError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array", cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // 행 6~36 (0-based row index 5~35), 열 B~S (index 1~18)
        const parsed: ParsedRow[] = [];

        for (let r = 5; r <= 35; r++) {
          const get = (c: number) => ws[XLSX.utils.encode_cell({ r, c })]?.v;

          const dateStr  = excelDateToStr(get(1));  // B
          const depTime  = toTimeStr(get(2));        // C
          const arrTime  = toTimeStr(get(3));        // D
          const depLoc   = String(get(6) ?? "").trim();  // G
          const arrLoc   = String(get(7) ?? "").trim();  // H
          const depKm    = toNumber(get(8));         // I
          const arrKm    = toNumber(get(9));         // J
          const tripType = String(get(11) ?? "").trim(); // L
          const purpose  = String(get(12) ?? "").trim(); // M
          const tollHp   = toNumber(get(16));        // Q
          const tollEtc  = toNumber(get(17));        // R
          const noteVal  = String(get(18) ?? "").trim(); // S

          // 빈 행 건너뜀 (출발지+도착지+km 모두 없으면)
          if (!depLoc && !arrLoc && !depKm && !arrKm) continue;

          const errors: string[] = [];
          if (!depLoc)  errors.push("출발지 없음");
          if (!arrLoc)  errors.push("도착지 없음");
          if (!depTime) errors.push("출발시간 없음");
          if (!arrTime) errors.push("도착시간 없음");
          if (!tripType || !VALID_TYPES.includes(tripType)) errors.push("운행유형 오류");
          if (!purpose) errors.push("목적 없음");
          if (arrKm <= depKm) errors.push("도착km ≤ 출발km");

          parsed.push({
            rowNum:    r - 4,  // 1-based 행 번호
            date:      dateStr,
            dep_time:  depTime,
            arr_time:  arrTime,
            dep_loc:   depLoc,
            arr_loc:   arrLoc,
            dep_km:    depKm,
            arr_km:    arrKm,
            distance:  arrKm - depKm,
            trip_type: tripType,
            purpose,
            toll_fee:  tollHp + tollEtc,
            note:      noteVal,
            error:     errors.length ? errors.join(", ") : undefined,
          });
        }

        setRows(parsed);
        setStep("preview");
      } catch (err) {
        setApiError("파일을 읽을 수 없습니다. 올바른 양식인지 확인하세요.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const validRows   = rows.filter(r => !r.error);
  const invalidRows = rows.filter(r => r.error);

  async function handleUpload() {
    if (!validRows.length) return;
    setLoading(true);
    setApiError(null);

    const payload = validRows.map(r => ({
      departure_time:     `${r.date}T${r.dep_time}:00+09:00`,
      arrival_time:       `${r.date}T${r.arr_time}:00+09:00`,
      departure_location: r.dep_loc,
      arrival_location:   r.arr_loc,
      departure_km:       r.dep_km,
      arrival_km:         r.arr_km,
      toll_fee:           r.toll_fee,
      trip_type:          r.trip_type,
      purpose:            r.purpose,
      note:               r.note || undefined,
    }));

    const res = await fetch("/api/trips/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicle_id: vehicleId, rows: payload }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      const detail = data.details?.join("\n") ?? data.error ?? "업로드 실패";
      setApiError(detail);
      return;
    }

    setResult(`${data.inserted}건 등록 완료 (승인 대기 상태)`);
    setStep("done");
    setTimeout(() => { router.refresh(); }, 1500);
  }

  function handleReset() {
    setStep("idle");
    setRows([]);
    setFileName("");
    setResult(null);
    setApiError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const TYPE_COLOR: Record<string, string> = {
    "업무":     "bg-blue-100 text-blue-700",
    "출퇴근":   "bg-emerald-100 text-emerald-700",
    "개인사용": "bg-orange-100 text-orange-700",
  };

  return (
    <div className="hidden md:block mx-4 mb-4">
      <div className="rounded-2xl border border-border bg-background overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div>
            <p className="text-sm font-semibold">📊 Excel 일괄 업로드</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              PC에서만 사용 가능 · 양식을 다운로드 후 작성하여 업로드하세요
            </p>
          </div>
          <a
            href="/차량운행기록부_양식.xlsx"
            download
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted transition-colors shrink-0"
          >
            📥 양식 다운로드
          </a>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* ── STEP: idle ── */}
          {step === "idle" && (
            <div>
              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                <p className="text-sm font-medium">📂 Excel 파일 선택</p>
                <p className="text-xs text-muted-foreground mt-1">.xlsx 파일만 지원</p>
                <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
              </label>
              {apiError && (
                <p className="mt-2 text-xs text-destructive">{apiError}</p>
              )}
            </div>
          )}

          {/* ── STEP: preview ── */}
          {step === "preview" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">📄 {fileName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    총 {rows.length}행 파싱 ·{" "}
                    <span className="text-emerald-600 font-medium">정상 {validRows.length}건</span>
                    {invalidRows.length > 0 && (
                      <span className="text-destructive font-medium"> · 오류 {invalidRows.length}건 (제외됨)</span>
                    )}
                  </p>
                </div>
                <button onClick={handleReset}
                  className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5">
                  다시 선택
                </button>
              </div>

              {/* 오류 행 */}
              {invalidRows.length > 0 && (
                <div className="rounded-xl bg-destructive/5 border border-destructive/20 px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-destructive">⚠️ 아래 행은 오류로 제외됩니다</p>
                  {invalidRows.map(r => (
                    <p key={r.rowNum} className="text-xs text-destructive">
                      행{r.rowNum} ({r.date}) — {r.error}
                    </p>
                  ))}
                </div>
              )}

              {/* 미리보기 테이블 */}
              {validRows.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted">
                        {["날짜","출발","도착","출발지","도착지","출발km","도착km","km","유형","목적","통행료"].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {validRows.map(r => (
                        <tr key={r.rowNum} className="hover:bg-muted/30">
                          <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.dep_time}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.arr_time}</td>
                          <td className="px-3 py-2 max-w-28 truncate">{r.dep_loc}</td>
                          <td className="px-3 py-2 max-w-28 truncate">{r.arr_loc}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-right">{r.dep_km.toLocaleString("ko-KR")}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-right">{r.arr_km.toLocaleString("ko-KR")}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-right font-semibold text-primary">{r.distance.toLocaleString("ko-KR")}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 font-medium ${TYPE_COLOR[r.trip_type] ?? "bg-gray-100 text-gray-600"}`}>
                              {r.trip_type}
                            </span>
                          </td>
                          <td className="px-3 py-2 max-w-32 truncate">{r.purpose}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-right">
                            {r.toll_fee > 0 ? r.toll_fee.toLocaleString("ko-KR") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {apiError && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
                  <p className="text-sm text-destructive whitespace-pre-line">{apiError}</p>
                </div>
              )}

              {validRows.length > 0 && (
                <div className="flex gap-3">
                  <button onClick={handleReset}
                    className="flex-1 rounded-xl border border-border py-3 text-sm font-medium bg-background">
                    취소
                  </button>
                  <button onClick={handleUpload} disabled={loading}
                    className="flex-1 rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold disabled:opacity-50">
                    {loading ? "업로드 중..." : `✅ ${validRows.length}건 등록하기`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: done ── */}
          {step === "done" && (
            <div className="text-center py-6 space-y-3">
              <p className="text-3xl">✅</p>
              <p className="text-sm font-semibold text-emerald-700">{result}</p>
              <p className="text-xs text-muted-foreground">잠시 후 목록이 갱신됩니다</p>
              <button onClick={handleReset}
                className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-4 py-2">
                다시 업로드
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
