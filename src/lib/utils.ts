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
