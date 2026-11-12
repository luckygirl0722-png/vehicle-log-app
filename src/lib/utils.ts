import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind 클래스 병합 유틸리티 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 숫자를 한국 통화 형식으로 변환 (예: 1500 → "1,500원") */
export function formatKRW(amount: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
  }).format(amount);
}

/** km 수치 포맷 (예: 12345 → "12,345 km") */
export function formatKm(km: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(km)} km`;
}

// ─────────────────────────────────────────────────────────────
// KST(한국시간) 월 경계 유틸 — 서버(Vercel)는 UTC이므로
// new Date(y, m-1, 1) 로 월 범위를 만들면 KST 1일 00:00~08:59 기록이 누락되고
// 다음 달 1일 00:00~08:59 기록이 섞여 들어옴. 반드시 아래 함수 사용.
// ─────────────────────────────────────────────────────────────
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 기준 y년 m월(1~12)의 [시작, 다음달 시작) ISO 문자열 */
export function kstMonthRange(y: number, m: number): { from: string; to: string } {
  return {
    from: new Date(Date.UTC(y, m - 1, 1) - KST_OFFSET_MS).toISOString(),
    to:   new Date(Date.UTC(y, m,     1) - KST_OFFSET_MS).toISOString(),
  };
}

/** KST 기준 y년 전체 [1/1, 다음해 1/1) ISO 문자열 */
export function kstYearRange(y: number): { from: string; to: string } {
  return {
    from: new Date(Date.UTC(y,     0, 1) - KST_OFFSET_MS).toISOString(),
    to:   new Date(Date.UTC(y + 1, 0, 1) - KST_OFFSET_MS).toISOString(),
  };
}

/**
 * 현재 시각을 "로컬 필드 = KST" 인 Date 로 반환.
 * getFullYear()/getMonth()/getDate() 가 서버 타임존과 무관하게 KST 값을 돌려줌.
 */
export function kstNow(): Date {
  const n = new Date();
  return new Date(n.getTime() + KST_OFFSET_MS + n.getTimezoneOffset() * 60_000);
}

/** ISO 시각의 KST 연·월(1~12) */
export function kstYearMonth(iso: string): { y: number; m: number } {
  const d = new Date(new Date(iso).getTime() + KST_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}
