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
    .select("school_id,role").eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
  if(membershipError||!membership) redirect("/login?error=school-access");
  if(!["owner","admin","employee"].includes(membership.role)) {
    redirect("/school/instructor?notice=forbidden");
  }

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
