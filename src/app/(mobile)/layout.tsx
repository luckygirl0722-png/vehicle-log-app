import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/auth/LogoutButton";

/**
 * 모바일(운전자) 레이아웃
 * - 인증 확인 (미들웨어 이중 방어)
 * - 하단 고정 내비게이션
 */
export default async function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const { data: driver } = await supabase
    .from("drivers")
    .select("name")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-muted flex flex-col max-w-md mx-auto">
      {/* 상단 헤더 */}
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between sticky top-0 z-40 pt-safe">
        <div>
          <h1 className="text-base font-bold">차량 운행일지</h1>
          <p className="text-xs text-primary-foreground/70">
            {driver?.name ?? user.email}
          </p>
        </div>
        <LogoutButton className="text-xs text-primary-foreground/80 hover:text-primary-foreground" />
      </header>

      {/* 본문 */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* 하단 내비게이션 */}
      <nav className="bg-background border-t border-border pb-safe sticky bottom-0">
        <div className="flex">
          <a href="/"
            className="flex-1 flex flex-col items-center py-3 text-xs text-muted-foreground hover:text-primary gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            홈
          </a>
          <a href="/trip/start"
            className="flex-1 flex flex-col items-center py-3 text-xs text-muted-foreground hover:text-primary gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            운행시작
          </a>
          <a href="/my-trips"
            className="flex-1 flex flex-col items-center py-3 text-xs text-muted-foreground hover:text-primary gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            내 기록
          </a>
        </div>
      </nav>
    </div>
  );
}
