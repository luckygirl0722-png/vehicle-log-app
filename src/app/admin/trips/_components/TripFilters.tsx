"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

interface FilterOption { id: string; label: string }

interface TripFiltersProps {
  vehicles: FilterOption[];
  drivers:  FilterOption[];
}

const STATUS_OPTIONS = [
  { value: "",          label: "전체 상태" },
  { value: "draft",     label: "작성중" },
  { value: "submitted", label: "승인대기" },
  { value: "approved",  label: "승인완료" },
  { value: "rejected",  label: "반려됨" },
];

export default function TripFilters({ vehicles, drivers }: TripFiltersProps) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("page"); // 필터 변경 시 1페이지로
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [searchParams, pathname, router]
  );

  const now = new Date();
  // 과거 12개월 + 미래 3개월 옵션 (총 16개월, 최신 순)
  const monthOptions = Array.from({ length: 16 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + 3 - i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const l = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
    return { value: v, label: l };
  });

  const selClass =
    "h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50";

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* 기간 (월) */}
      <select
        className={selClass}
        value={searchParams.get("month") ?? ""}
        onChange={e => updateParam("month", e.target.value)}
        disabled={isPending}
      >
        <option value="">전체 기간</option>
        {monthOptions.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* 차량 */}
      <select
        className={selClass}
        value={searchParams.get("vehicle_id") ?? ""}
        onChange={e => updateParam("vehicle_id", e.target.value)}
        disabled={isPending}
      >
        <option value="">전체 차량</option>
        {vehicles.map(v => (
          <option key={v.id} value={v.id}>{v.label}</option>
        ))}
      </select>

      {/* 운전자 */}
      <select
        className={selClass}
        value={searchParams.get("driver_id") ?? ""}
        onChange={e => updateParam("driver_id", e.target.value)}
        disabled={isPending}
      >
        <option value="">전체 운전자</option>
        {drivers.map(d => (
          <option key={d.id} value={d.id}>{d.label}</option>
        ))}
      </select>

      {/* 상태 */}
      <select
        className={selClass}
        value={searchParams.get("status") ?? ""}
        onChange={e => updateParam("status", e.target.value)}
        disabled={isPending}
      >
        {STATUS_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* 초기화 */}
      {(searchParams.get("month") || searchParams.get("vehicle_id") ||
        searchParams.get("driver_id") || searchParams.get("status")) && (
        <button
          onClick={() => startTransition(() => router.push(pathname))}
          className="h-8 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground border border-input bg-background"
          disabled={isPending}
        >
          초기화
        </button>
      )}

      {isPending && (
        <span className="text-xs text-muted-foreground animate-pulse">조회 중...</span>
      )}
    </div>
  );
}
