"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updateStudentModuleProgress(formData:FormData):Promise<void> {
  const supabase=await createSupabaseServerClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user) redirect("/login");

  const {data:profile,error:profileError}=await supabase.from("profiles")
    .select("account_type").eq("id",user.id).maybeSingle();
  if(profileError||profile?.account_type!=="school") redirect("/login?error=school-access");

  const {data:membership,error:membershipError}=await supabase.from("school_members")
    .select("school_id,role").eq("user_id",user.id).eq("status","active").eq("role","owner").maybeSingle();
  if(membershipError||!membership) redirect("/login?error=school-access");
  if(membership.role!=="owner") redirect("/school?notice=forbidden");

  const progressId=String(formData.get("progress_id")??"").trim();
  const status=String(formData.get("status")??"");
  const notes=String(formData.get("notes")??"").trim();

  if(!progressId||!["not_started","scheduled","in_progress","completed"].includes(status)||notes.length>1000) {
    redirect("/school/students?notice=progress-invalid");
  }

  const completed=status==="completed";
  const {data,error}=await supabase.from("student_module_progress")
    .update({
      status,
      completed_at:completed?new Date().toISOString():null,
      validated_by:completed?user.id:null,
      notes:notes||null
    })
    .eq("id",progressId)
    .eq("school_id",membership.school_id)
    .select("student_id")
    .maybeSingle();

  if(error||!data) {
    const message=error?.message.toLowerCase()??"";
    if(message.includes("modules 1 through 4")) {
      redirect("/school/students?notice=module-five-prerequisite");
    }
    redirect("/school/students?notice=progress-error");
  }

  revalidatePath("/school/students/"+data.student_id);
  revalidatePath("/student");
  revalidatePath("/school");
  redirect("/school/students/"+data.student_id+"?notice=progress-updated");
}


export async function advanceStudentPhase(formData:FormData):Promise<void> {
  const supabase=await createSupabaseServerClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user) redirect("/login");

  const {data:profile,error:profileError}=await supabase.from("profiles")
    .select("account_type").eq("id",user.id).maybeSingle();
  if(profileError||profile?.account_type!=="school") redirect("/login?error=school-access");

  const {data:membership,error:membershipError}=await supabase.from("school_members")
    .select("school_id,role").eq("user_id",user.id).eq("status","active").eq("role","owner").maybeSingle();
  if(membershipError||!membership) redirect("/login?error=school-access");
  if(membership.role!=="owner") redirect("/school?notice=forbidden");

  const studentId=String(formData.get("student_id")??"").trim();
  if(!studentId) redirect("/school/students?notice=phase-error");

  const {data:student,error:studentError}=await supabase.from("students")
    .select("id,current_phase_id")
    .eq("id",studentId)
    .eq("school_id",membership.school_id)
    .maybeSingle();
  if(studentError||!student?.current_phase_id) {
    redirect("/school/students?notice=student-not-found");
  }

  const {data:currentPhase,error:currentError}=await supabase.from("curriculum_phases")
    .select("phase_number")
    .eq("id",student.current_phase_id)
    .maybeSingle();
  if(currentError||!currentPhase||currentPhase.phase_number>=4) {
    redirect("/school/students/"+studentId+"?notice=phase-final");
  }

  const nextNumber=currentPhase.phase_number+1;
  const {data:schoolPhase,error:schoolPhaseError}=await supabase.from("curriculum_phases")
    .select("id")
    .eq("school_id",membership.school_id)
    .eq("phase_number",nextNumber)
    .maybeSingle();
  if(schoolPhaseError) redirect("/school/students/"+studentId+"?notice=phase-error");

  const {data:globalPhase,error:globalError}=schoolPhase
    ?{data:null,error:null}
    :await supabase.from("curriculum_phases")
      .select("id")
      .is("school_id",null)
      .eq("phase_number",nextNumber)
      .maybeSingle();
  if(globalError) redirect("/school/students/"+studentId+"?notice=phase-error");

  const targetPhase=schoolPhase?.id??globalPhase?.id;
  if(!targetPhase) redirect("/school/students/"+studentId+"?notice=phase-error");

  const {error:updateError}=await supabase.from("students")
    .update({current_phase_id:targetPhase})
    .eq("id",studentId)
    .eq("school_id",membership.school_id)
    .eq("current_phase_id",student.current_phase_id)
    .select("id")
    .maybeSingle();

  if(updateError) {
    const message=updateError.message.toLowerCase();
    if(message.includes("minimum time")) redirect("/school/students/"+studentId+"?notice=phase-duration");
    if(message.includes("must be completed")) redirect("/school/students/"+studentId+"?notice=phase-incomplete");
    redirect("/school/students/"+studentId+"?notice=phase-error");
  }

  revalidatePath("/school/students/"+studentId);
  revalidatePath("/student");
  revalidatePath("/school");
  redirect("/school/students/"+studentId+"?notice=phase-advanced");
}
