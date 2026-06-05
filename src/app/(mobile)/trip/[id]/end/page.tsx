import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import TripEndForm from "./_components/TripEndForm";

export const metadata = { title: "운행 완료 — 차량 운행일지" };

type Props = { params: { id: string } };

export default async function TripEndPage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trip } = await supabase
    .from("trip_logs")
    .select("*, vehicles(plate_number, model)")
    .eq("id", params.id)
    .single();

  if (!trip) notFound();

  // 이미 도착 등록된 경우 완료 화면으로
  if (trip.arrival_time) redirect(`/trip/${params.id}/complete`);
  if (trip.status !== "draft") redirect("/");

  return (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">운행 완료</h2>
        <p className="text-sm text-muted-foreground mt-1">도착 정보를 입력해 주세요</p>
      </div>
      <TripEndForm trip={trip as any} />
    </div>
  );
}
