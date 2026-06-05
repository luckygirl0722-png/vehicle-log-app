import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/auth/LogoutButton";

/**
 * 관리자 레이아웃 — 사이드바 + 콘텐츠 영역
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roleRow } = await supabase
    .from("user_roles").select("role").eq("user_id", user.id).single();
  if (roleRow?.role !== "admin") redirect("/");

  const navItems = [
    { href: "/admin/dashboard", label: "대시보드" },
    { href: "/admin/trips",     label: "운행 현황" },
    { href: "/admin/vehicles",  label: "차량 관리" },
    { href: "/admin/drivers",   label: "운전자 관리" },
    { href: "/admin/approvals", label: "승인 관리" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* 사이드바 */}
      <aside className="w-56 bg-primary text-primary-foreground flex flex-col fixed inset-y-0 left-0 z-40">
        <div className="px-4 py-5 border-b border-primary-foreground/10">
          <h1 className="font-bold text-base">차량 운행일지</h1>
          <p className="text-xs text-primary-foreground/60 mt-0.5">관리자</p>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="block px-3 py-2 rounded-lg text-sm text-primary-foreground/80
                         hover:bg-primary-foreground/10 hover:text-primary-foreground transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-primary-foreground/10">
          <p className="text-xs text-primary-foreground/50 mb-2">{user.email}</p>
          <LogoutButton className="text-xs text-primary-foreground/70 hover:text-primary-foreground" />
        </div>
      </aside>

      {/* 콘텐츠 */}
      <main className="ml-56 flex-1 bg-muted/30 min-h-screen">
        {children}
      </main>
    </div>
  );
}
