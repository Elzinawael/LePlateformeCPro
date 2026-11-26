"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function schedulePracticalLesson(formData:FormData):Promise<void> {
  const supabase=await createSupabaseServerClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)redirect("/login");
  const {data:profile,error:profileError}=await supabase.from("profiles").select("account_type").eq("id",user.id).maybeSingle();
  if(profileError||profile?.account_type!=="school")redirect("/login?error=school-access");
  const {data:membership,error:membershipError}=await supabase.from("school_members")
    .select("school_id,role").eq("user_id",user.id).eq("status","active").eq("role","owner").maybeSingle();
  if(membershipError||!membership)redirect("/login?error=school-access");

  const progressId=String(formData.get("progress_id")??"").trim();
  const localDateTime=String(formData.get("scheduled_at")??"").trim();
  const trainerName=String(formData.get("instructor_name")??"").trim();
  const notes=String(formData.get("notes")??"").trim();
  const offset=Number(formData.get("timezone_offset"));
  if(!progressId||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localDateTime)
    ||!Number.isInteger(offset)||Math.abs(offset)>840||!trainerName||trainerName.length>120||notes.length>1000) {
    redirect("/school/practical?notice=invalid");
  }
  const sign=offset<=0?"+":"-";
  const abs=Math.abs(offset);
  const iso=new Date(localDateTime+":00"+sign+String(Math.floor(abs/60)).padStart(2,"0")+":"+String(abs%60).padStart(2,"0"));
  if(Number.isNaN(iso.getTime())||iso<=new Date())redirect("/school/practical?notice=datetime-invalid");

  const {data,error}=await supabase.from("student_practical_progress").update({
    status:"scheduled",
    scheduled_at:iso.toISOString(),
    instructor_user_id:null,
    instructor_name:trainerName,
    notes:notes||null
  }).eq("id",progressId).eq("school_id",membership.school_id).select("student_id").maybeSingle();

  if(error||!data) {
    const message=error?.message.toLowerCase()??"";
    if(message.includes("current phase"))redirect("/school/practical?notice=phase-invalid");
    if(message.includes("already has")||message.includes("during this time"))redirect("/school/practical?notice=conflict");
    if(message.includes("trainer"))redirect("/school/practical?notice=trainer-required");
    redirect("/school/practical?notice=schedule-error");
  }
  revalidatePath("/school");
  revalidatePath("/school/practical");
  revalidatePath("/school/students/"+data.student_id);
  revalidatePath("/student");
  redirect("/school/practical?notice=scheduled");
}


export async function completePracticalLesson(formData:FormData):Promise<void> {
  const supabase=await createSupabaseServerClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)redirect("/login");
  const {data:profile,error:profileError}=await supabase.from("profiles")
    .select("account_type").eq("id",user.id).maybeSingle();
  if(profileError||profile?.account_type!=="school")redirect("/login?error=school-access");
  const {data:membership,error:membershipError}=await supabase.from("school_members")
    .select("school_id,role").eq("user_id",user.id).eq("status","active").eq("role","owner").maybeSingle();
  if(membershipError||!membership)redirect("/login?error=school-access");

  const progressId=String(formData.get("progress_id")??"").trim();
  if(!progressId)redirect("/school/practical?notice=complete-error");

  const {data:progress,error:progressError}=await supabase.from("student_practical_progress")
    .select("id,student_id,status,scheduled_at,instructor_name,instructor_user_id")
    .eq("id",progressId).eq("school_id",membership.school_id).maybeSingle();
  if(progressError||!progress)redirect("/school/practical?notice=complete-error");
  if(!["scheduled","in_progress"].includes(progress.status))redirect("/school/practical?notice=complete-state");
  if(!progress.scheduled_at||new Date(progress.scheduled_at).getTime()>Date.now()) {
    redirect("/school/practical?notice=complete-future");
  }
  if(!progress.instructor_name&&!progress.instructor_user_id)redirect("/school/practical?notice=trainer-required");

  const {data:updated,error}=await supabase.from("student_practical_progress").update({
    status:"completed",
    completed_at:new Date().toISOString(),
    validated_by:user.id
  }).eq("id",progressId).eq("school_id",membership.school_id)
    .in("status",["scheduled","in_progress"]).select("student_id").maybeSingle();
  if(error||!updated)redirect("/school/practical?notice=complete-error");
  revalidatePath("/school");
  revalidatePath("/school/practical");
  revalidatePath("/school/students/"+updated.student_id);
  revalidatePath("/student");
  redirect("/school/practical?notice=completed");
}
