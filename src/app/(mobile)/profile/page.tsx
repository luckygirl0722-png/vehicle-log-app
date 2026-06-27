import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/auth/LogoutButton";
import ChangePasswordForm from "./_components/ChangePasswordForm";

export const metadata = { title: "프로필 — 차량 운행일지" };

interface Props {
  searchParams: Promise<{ force?: string }>;
}

export default async function ProfilePage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: driver } = await supabase
    .from("drivers")
    .select("name, employee_no, department, phone, email, password_changed")
    .eq("user_id", user.id)
    .single();

  const { force } = await searchParams;
  const isForced = force === "true";

  return (
    <div className="p-4 space-y-4">

      {/* 최초 로그인 강제 변경 안내 배너 */}
      {isForced && (
        <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 flex gap-3 items-start">
          <span className="text-amber-500 text-xl mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">비밀번호 변경 필요</p>
            <p className="text-xs text-amber-700 mt-0.5">
              초기 비밀번호를 개인 비밀번호로 변경해야 앱을 사용할 수 있습니다.
            </p>
          </div>
        </div>
      )}

      <h2 className="text-lg font-bold">내 프로필</h2>

      {/* 기본 정보 */}
      <div className="rounded-xl bg-background border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">기본 정보</h3>

        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
            {driver?.name?.charAt(0) ?? "?"}
          </div>
          <div>
            <p className="text-lg font-bold">{driver?.name ?? "—"}</p>
            <p className="text-sm text-muted-foreground">{driver?.department ?? "—"}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">사원번호</p>
            <p className="font-medium font-mono">{driver?.employee_no ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">휴대폰</p>
            <p className="font-medium">{driver?.phone ?? "—"}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground mb-0.5">로그인 이메일</p>
            <p className="font-medium">{driver?.email ?? user.email ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* 비밀번호 변경 */}
      <div className="rounded-xl bg-background border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">비밀번호 변경</h3>
        <ChangePasswordForm isForced={isForced} />
      </div>

      {/* 로그아웃 — 강제 변경 모드에서는 숨김 */}
      {!isForced && (
        <div className="rounded-xl bg-background border p-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">계정</h3>
          <LogoutButton className="w-full text-sm text-destructive border border-destructive/30 rounded-lg py-2 hover:bg-destructive/5 transition-colors" />
        </div>
      )}
    </div>
  );
}
