export default function VehicleTripsLoading() {
  return (
    <div className="p-4 space-y-3">
      {/* 차량 선택 드롭다운 */}
      <div className="h-10 bg-muted rounded-lg animate-pulse" />

      {/* 차량 정보 카드 */}
      <div className="rounded-xl border bg-background p-3 animate-pulse">
        <div className="h-4 w-28 bg-muted rounded mb-2" />
        <div className="h-3 w-20 bg-muted rounded" />
      </div>

      {/* 운행 목록 */}
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-xl border bg-background p-3 animate-pulse">
          <div className="flex justify-between mb-2">
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-4 w-14 bg-muted rounded" />
          </div>
          <div className="h-3 w-40 bg-muted rounded mb-1" />
          <div className="h-3 w-32 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}
