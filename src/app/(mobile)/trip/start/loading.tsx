export default function TripStartLoading() {
  return (
    <div className="p-4 space-y-4">
      {/* 제목 */}
      <div className="h-6 w-24 bg-muted rounded animate-pulse" />

      {/* 운행 유형 버튼 3개 */}
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>

      {/* 폼 필드 스켈레톤 */}
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-1 animate-pulse">
          <div className="h-3 w-20 bg-muted rounded" />
          <div className="h-10 bg-muted rounded-lg" />
        </div>
      ))}

      {/* 버튼 */}
      <div className="h-12 bg-muted rounded-xl animate-pulse mt-2" />
    </div>
  );
}
