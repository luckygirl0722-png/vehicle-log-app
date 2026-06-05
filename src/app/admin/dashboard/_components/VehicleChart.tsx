"use client";

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface VehicleData {
  plate_number: string;
  distance:     number;
  tripCount:    number;
}

interface VehicleChartProps {
  data: VehicleData[];
}

// 브랜드 컬러 계열 팔레트
const COLORS = [
  "hsl(214 59% 29%)",  // 곤색
  "hsl(214 59% 45%)",
  "hsl(214 59% 60%)",
  "hsl(214 59% 72%)",
  "hsl(214 30% 55%)",
  "hsl(214 20% 70%)",
];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-medium">{d.plate_number}</p>
      <p className="text-muted-foreground">운행거리: {d.distance.toLocaleString("ko-KR")} km</p>
      <p className="text-muted-foreground">운행 건수: {d.tripCount}건</p>
    </div>
  );
}

function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null; // 5% 미만은 레이블 생략
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function VehicleChart({ data }: VehicleChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        데이터가 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="distance"
            nameKey="plate_number"
            cx="50%"
            cy="50%"
            outerRadius={85}
            labelLine={false}
            label={CustomLabel}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* 범례 테이블 */}
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={d.plate_number} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="font-medium">{d.plate_number}</span>
            </div>
            <span className="text-muted-foreground">
              {d.distance.toLocaleString("ko-KR")} km · {d.tripCount}건
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
