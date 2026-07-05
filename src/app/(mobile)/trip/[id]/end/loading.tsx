export default function TripEndLoading() {
  return (
    <div className="p-4 space-y-4">
      {/* 제목 */}
      <div className="h-6 w-28 bg-muted rounded animate-pulse" />
      <div className="h-4 w-48 bg-muted rounded animate-pulse" />

      {/* 출발 정보 카드 */}
      <div className="rounded-2xl border border-border p-4 space-y-2 animate-pulse">
        <div className="h-4 w-24 bg-muted rounded" />
        <div className="h-4 w-40 bg-muted rounded" />
        <div className="h-4 w-32 bg-muted rounded" />
      </div>

      {/* 폼 필드 */}
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
