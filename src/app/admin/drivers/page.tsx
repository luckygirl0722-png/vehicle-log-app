import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DriversClient from "./_components/DriversClient";

export const metadata = { title: "운전자 관리 — 차량 운행일지" };

export default async function DriversPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roleRow } = await supabase
    .from("user_roles").select("role").eq("user_id", user.id).single();
  if (roleRow?.role !== "admin") redirect("/");

  const { data: drivers } = await supabase
    .from("drivers")
    .select("*")
    .order("employee_no");

  return (
    <div className="p-6">
      <DriversClient drivers={drivers ?? []} />
    </div>
  );
}
