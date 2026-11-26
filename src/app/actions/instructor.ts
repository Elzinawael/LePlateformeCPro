"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updateAssignedPracticalProgress(formData:FormData):Promise<void> {
  const supabase=await createSupabaseServerClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user) redirect("/login");

  const {data:profile,error:profileError}=await supabase.from("profiles")
    .select("account_type").eq("id",user.id).maybeSingle();
  if(profileError||profile?.account_type!=="school") redirect("/login?error=school-access");

  const {data:membership,error:membershipError}=await supabase.from("school_members")
    .select("school_id,role").eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
  if(membershipError||!membership||membership.role!=="instructor") {
    redirect("/school?notice=forbidden");
  }

  const progressId=String(formData.get("progress_id")??"").trim();
  const status=String(formData.get("status")??"");
  const notes=String(formData.get("notes")??"").trim();
  if(!progressId||!["in_progress","completed"].includes(status)||notes.length>1000) {
    redirect("/school/instructor?notice=invalid");
  }

  const completed=status==="completed";
  const {data,error}=await supabase.from("student_practical_progress")
    .update({
      status,
      completed_at:completed?new Date().toISOString():null,
      validated_by:completed?user.id:null,
      notes:notes||null
    })
    .eq("id",progressId)
    .eq("school_id",membership.school_id)
    .select("id")
    .maybeSingle();

  if(error||!data) redirect("/school/instructor?notice=update-error");
  revalidatePath("/school/instructor");
  revalidatePath("/student");
  redirect("/school/instructor?notice=updated");
}
