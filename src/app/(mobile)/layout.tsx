import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: driver } = await supabase
    .from("drivers")
    .select("name")
    .eq("user_id", user.id)
    .single();

  // 비밀번호 미변경 체크 — user_metadata 사용 (RLS 무관, 즉시 반영)
  // password_changed가 명시적으로 true가 아니면 변경 필요로 판단
  const passwordChanged = user.user_metadata?.password_changed === true;
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  if (!passwordChanged && !pathname.startsWith("/profile")) {
    redirect("/profile?force=true");
  }

  const navItems = [
    { href: "/",              icon: "🏠", label: "홈" },
    { href: "/trip/start",    icon: "🚗", label: "운행시작" },
    { href: "/vehicle-trips", icon: "📋", label: "차량기록" },
    { href: "/profile",       icon: "👤", label: "프로필" },
  ];

  return (
    <div className="min-h-screen bg-muted flex flex-col max-w-md mx-auto">
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center sticky top-0 z-40">
        <div>
          <h1 className="text-base font-bold">차량 운행일지</h1>
          <p className="text-xs text-primary-foreground/70">{driver?.name ?? user.email}</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-16">{children}</main>

      <nav className="bg-background border-t border-border sticky bottom-0 z-40">
        <div className="flex">
          {navItems.map(({ href, icon, label }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <a key={href} href={href}
                className={`flex-1 flex flex-col items-center py-2.5 text-xs gap-0.5 transition-colors relative
                  ${isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-primary"}`}>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-b-full" />
                )}
                <span className="text-base">{icon}</span>
                <span>{label}</span>
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
