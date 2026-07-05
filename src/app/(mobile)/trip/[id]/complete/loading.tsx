export default function TripCompleteLoading() {
  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="h-16 w-16 bg-muted rounded-full animate-pulse" />
      <div className="h-6 w-40 bg-muted rounded animate-pulse" />
      <div className="h-4 w-56 bg-muted rounded animate-pulse" />
      <div className="w-full max-w-sm rounded-2xl border border-border p-4 space-y-3 animate-pulse">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between">
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-4 w-24 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="h-12 w-full max-w-sm bg-muted rounded-xl animate-pulse" />
    </div>
  );
}
