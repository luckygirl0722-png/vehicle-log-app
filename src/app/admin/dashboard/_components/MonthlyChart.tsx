"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

interface MonthlyData {
  month: string;      // 예: "1월"
  distance: number;   // km
  toll: number;       // 원
}

interface MonthlyChartProps {
  data: MonthlyData[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value.toLocaleString("ko-KR")}
          {p.name === "운행거리" ? " km" : " 원"}
        </p>
      ))}
    </div>
  );
}

export default function MonthlyChart({ data }: MonthlyChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        데이터가 없습니다
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
        barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214 17% 88%)" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: "hsl(215 13% 45%)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="distance"
          orientation="left"
          tick={{ fontSize: 11, fill: "hsl(215 13% 45%)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${v}km`}
          width={48}
        />
        <YAxis
          yAxisId="toll"
          orientation="right"
          tick={{ fontSize: 11, fill: "hsl(215 13% 45%)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="rect"
          iconSize={10}
          formatter={v => <span style={{ fontSize: 12, color: "hsl(215 13% 45%)" }}>{v}</span>}
        />
        <Bar yAxisId="distance" dataKey="distance" name="운행거리"
          fill="hsl(214 59% 29%)" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="toll"     dataKey="toll"     name="통행료"
          fill="hsl(214 59% 65%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
