"use client";

import { useRouter } from "next/navigation";

interface Props {
  statsMonthLabel: string;
  statsMonthParam: string;
  prevStatsParam:  string;
  nextStatsParam:  string;
  /** 드롭다운 옵션: { value: "YYYY-MM", label: "YYYY년 MM월" }[] */
  options: { value: string; label: string }[];
}

export default function MonthNavBar({
  statsMonthLabel,
  statsMonthParam,
  prevStatsParam,
  nextStatsParam,
  options,
}: Props) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
      <a
        href={`?stats_month=${prevStatsParam}`}
        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground text-sm font-bold"
      >
        ‹
      </a>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">{statsMonthLabel}</span>
        <select
          value={statsMonthParam}
          onChange={(e) => router.push(`?stats_month=${e.target.value}`)}
          className="text-xs border border-border rounded-lg px-2 py-1 bg-background focus:outline-none cursor-pointer"
        >
          {options.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <a
        href={`?stats_month=${nextStatsParam}`}
        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground text-sm font-bold"
      >
        ›
      </a>
    </div>
  );
}
