import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import TripEndForm from "./_components/TripEndForm";

export const metadata = { title: "운행 완료 — 차량 운행일지" };
type Props = { params: { id: string }; searchParams: { edit?: string } };

export default async function TripEndPage({ params, searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trip } = await supabase
    .from("trip_logs")
    .select("*, vehicles(plate_number, model)")
    .eq("id", params.id)
    .single();

  if (!trip) notFound();
  if (trip.status !== "draft") redirect("/");

  const isEditMode = searchParams.edit === "1";

  // 도착 등록 완료된 기록 → edit=1 없으면 완료 화면으로
  if (trip.arrival_time && !isEditMode) {
    redirect(`/trip/${params.id}/complete`);
  }

  return (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">
          {isEditMode ? "운행 정보 수정" : "운행 완료"}
        </h2>
        {isEditMode && (
          <p className="text-sm text-muted-foreground mt-1">수정할 내용을 입력하세요</p>
        )}
      </div>
      <TripEndForm trip={trip as any} isEditMode={isEditMode} />
    </div>
  );
}
