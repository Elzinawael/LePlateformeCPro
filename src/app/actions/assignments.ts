"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getManagerContext() {
  const supabase=await createSupabaseServerClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user) redirect("/login");
  const {data:profile,error:profileError}=await supabase.from("profiles")
    .select("account_type").eq("id",user.id).maybeSingle();
  if(profileError||profile?.account_type!=="school") redirect("/login?error=school-access");
  const {data:membership,error:membershipError}=await supabase.from("school_members")
    .select("school_id,role").eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
  if(membershipError||!membership) redirect("/login?error=school-access");
  if(!["owner","admin","employee"].includes(membership.role)) redirect("/school/instructor?notice=forbidden");
  return {supabase,user,membership};
}

export async function assignInstructor(formData:FormData):Promise<void> {
  const {supabase,user,membership}=await getManagerContext();
  const instructorId=String(formData.get("instructor_user_id")??"").trim();
  const studentId=String(formData.get("student_id")??"").trim();
  if(!instructorId||!studentId) redirect("/school/instructors?notice=invalid");

  const [{data:instructor,error:instructorError},{data:student,error:studentError}]=await Promise.all([
    supabase.from("school_members").select("user_id")
      .eq("school_id",membership.school_id).eq("user_id",instructorId)
      .eq("role","instructor").eq("status","active").maybeSingle(),
    supabase.from("students").select("id")
      .eq("school_id",membership.school_id).eq("id",studentId).maybeSingle()
  ]);
  if(instructorError||studentError||!instructor||!student) {
    redirect("/school/instructors?notice=invalid");
  }

  const {error}=await supabase.from("instructor_student_assignments").upsert({
    school_id:membership.school_id,
    instructor_user_id:instructorId,
    student_id:studentId,
    assigned_by:user.id,
    active:true
  },{onConflict:"school_id,instructor_user_id,student_id"});

  if(error) redirect("/school/instructors?notice=assign-error");
  revalidatePath("/school/instructors");
  revalidatePath("/school/instructor");
  redirect("/school/instructors?notice=assigned");
}

export async function deactivateInstructorAssignment(formData:FormData):Promise<void> {
  const {supabase,membership}=await getManagerContext();
  const assignmentId=String(formData.get("assignment_id")??"").trim();
  if(!assignmentId) redirect("/school/instructors?notice=invalid");
  const {data,error}=await supabase.from("instructor_student_assignments")
    .update({active:false})
    .eq("id",assignmentId)
    .eq("school_id",membership.school_id)
    .select("id")
    .maybeSingle();
  if(error||!data) redirect("/school/instructors?notice=assign-error");
  revalidatePath("/school/instructors");
  revalidatePath("/school/instructor");
  redirect("/school/instructors?notice=unassigned");
}
