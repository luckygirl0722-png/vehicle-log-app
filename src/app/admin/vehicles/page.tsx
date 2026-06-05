import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import VehiclesClient from "./_components/VehiclesClient";

export const metadata = { title: "차량 관리 — 차량 운행일지" };

/**
 * 차량 관리 페이지 (Server Component)
 * - 데이터 fetch는 서버에서, 인터랙션은 VehiclesClient(클라이언트)에서 처리
 */
export default async function VehiclesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roleRow } = await supabase
    .from("user_roles").select("role").eq("user_id", user.id).single();
  if (roleRow?.role !== "admin") redirect("/");

  // 전체 차량 조회 (비활성 포함)
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .order("plate_number");

  return (
    <div className="p-6">
      <VehiclesClient vehicles={vehicles ?? []} />
    </div>
  );
}
