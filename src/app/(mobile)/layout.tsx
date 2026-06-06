import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/auth/LogoutButton";

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: driver } = await supabase
    .from("drivers").select("name").eq("user_id", user.id).single();

  const navItems = [
    { href: "/",               icon: "🏠", label: "홈" },
    { href: "/trip/start",     icon: "🚗", label: "운행시작" },
    { href: "/vehicle-trips",  icon: "📋", label: "차량기록" },
    { href: "/my-trips",       icon: "📝", label: "내 기록" },
  ];

  return (
    <div className="min-h-screen bg-muted flex flex-col max-w-md mx-auto">
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div>
          <h1 className="text-base font-bold">차량 운행일지</h1>
          <p className="text-xs text-primary-foreground/70">{driver?.name ?? user.email}</p>
        </div>
        <LogoutButton className="text-xs text-primary-foreground/80" />
      </header>

      <main className="flex-1 overflow-y-auto pb-16">{children}</main>

      <nav className="bg-background border-t border-border sticky bottom-0 z-40">
        <div className="flex">
          {navItems.map(({ href, icon, label }) => (
            <a key={href} href={href}
              className="flex-1 flex flex-col items-center py-2.5 text-xs text-muted-foreground gap-0.5 hover:text-primary transition-colors">
              <span className="text-base">{icon}</span>
              <span>{label}</span>
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
