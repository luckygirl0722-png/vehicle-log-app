export default function DriversLoading() {
  return (
    <div className="p-6 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-7 w-28 bg-muted rounded animate-pulse" />
          <div className="h-3 w-16 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-36 bg-muted rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>

      {/* 테이블 */}
      <div className="rounded-lg border bg-background overflow-hidden">
        {/* 헤더 행 */}
        <div className="flex gap-4 px-4 py-3 bg-muted/50 border-b">
          {[60, 80, 80, 100, 80, 60, 60, 100].map((w, i) => (
            <div key={i} className={`h-3 w-${w === 60 ? 16 : w === 80 ? 20 : w === 100 ? 24 : 28} bg-muted rounded animate-pulse`} />
          ))}
        </div>
        {/* 데이터 행 */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0 animate-pulse">
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-4 w-16 bg-muted rounded" />
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-4 w-28 bg-muted rounded" />
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-5 w-14 bg-muted rounded-full" />
            <div className="h-5 w-14 bg-muted rounded-full" />
            <div className="flex gap-1 ml-auto">
              <div className="h-7 w-16 bg-muted rounded" />
              <div className="h-7 w-10 bg-muted rounded" />
              <div className="h-7 w-10 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
