"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function localDateTimeToIso(value:string,offset:number):string|null {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
    ||!Number.isInteger(offset)||Math.abs(offset)>840) return null;
  const sign=offset<=0?"+":"-";
  const absolute=Math.abs(offset);
  const hours=String(Math.floor(absolute/60)).padStart(2,"0");
  const minutes=String(absolute%60).padStart(2,"0");
  const date=new Date(value+":00"+sign+hours+":"+minutes);
  return Number.isNaN(date.getTime())?null:date.toISOString();
}

async function requireSchoolOwner() {
  const supabase=await createSupabaseServerClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user) redirect("/login");
  const {data:profile,error:profileError}=await supabase.from("profiles")
    .select("account_type").eq("id",user.id).maybeSingle();
  if(profileError||profile?.account_type!=="school") redirect("/login?error=school-access");
  const {data:membership,error:membershipError}=await supabase.from("school_members")
    .select("school_id").eq("user_id",user.id).eq("status","active").eq("role","owner").maybeSingle();
  if(membershipError||!membership) redirect("/login?error=school-access");
  return {supabase,user,schoolId:membership.school_id};
}

export async function schedulePracticalLesson(formData:FormData):Promise<void> {
  const {supabase,schoolId}=await requireSchoolOwner();
  const progressId=String(formData.get("progress_id")??"").trim();
  const localDateTime=String(formData.get("scheduled_at")??"").trim();
  const notes=String(formData.get("notes")??"").trim();
  const offset=Number(formData.get("timezone_offset"));
  const scheduledAt=localDateTimeToIso(localDateTime,offset);

  if(!progressId||!scheduledAt||notes.length>1000) redirect("/school/practical?notice=invalid");
  if(new Date(scheduledAt)<=new Date()) redirect("/school/practical?notice=datetime-invalid");

  const {data:updated,error}=await supabase.from("student_practical_progress").update({
    status:"scheduled",
    scheduled_at:scheduledAt,
    notes:notes||null
  }).eq("id",progressId).eq("school_id",schoolId)
    .in("status",["not_started","scheduled"])
    .select("student_id").maybeSingle();

  if(error||!updated) {
    const message=error?.message.toLowerCase()??"";
    if(message.includes("current phase")) redirect("/school/practical?notice=phase-invalid");
    if(message.includes("already has")||message.includes("overlap")) redirect("/school/practical?notice=conflict");
    if(message.includes("future")) redirect("/school/practical?notice=datetime-invalid");
    redirect("/school/practical?notice=schedule-error");
  }

  revalidatePath("/school");
  revalidatePath("/school/practical");
  revalidatePath("/school/students/"+updated.student_id);
  revalidatePath("/student");
  redirect("/school/practical?notice=scheduled");
}

export async function completePracticalLesson(formData:FormData):Promise<void> {
  const {supabase,user,schoolId}=await requireSchoolOwner();
  const progressId=String(formData.get("progress_id")??"").trim();
  if(!progressId) redirect("/school/practical?notice=complete-error");

  const {data:progress,error:progressError}=await supabase.from("student_practical_progress")
    .select("id,student_id,status,scheduled_at")
    .eq("id",progressId).eq("school_id",schoolId).maybeSingle();
  if(progressError||!progress) redirect("/school/practical?notice=complete-error");
  if(!["scheduled","in_progress"].includes(progress.status)) redirect("/school/practical?notice=complete-state");
  if(!progress.scheduled_at||new Date(progress.scheduled_at).getTime()>Date.now()) {
    redirect("/school/practical?notice=complete-future");
  }

  const {data:updated,error}=await supabase.from("student_practical_progress").update({
    status:"completed",
    completed_at:new Date().toISOString(),
    validated_by:user.id
  }).eq("id",progressId).eq("school_id",schoolId)
    .in("status",["scheduled","in_progress"]).select("student_id").maybeSingle();
  if(error||!updated) redirect("/school/practical?notice=complete-error");

  revalidatePath("/school");
  revalidatePath("/school/practical");
  revalidatePath("/school/students/"+updated.student_id);
  revalidatePath("/student");
  redirect("/school/practical?notice=completed");
}
