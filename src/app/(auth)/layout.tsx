/**
 * 인증 레이아웃 — 로그인 페이지 전용
 * 헤더/사이드바 없는 중앙 정렬 레이아웃
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      {children}
    </div>
  );
}
