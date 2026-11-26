"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function reviewStudentPermit(formData:FormData):Promise<void> {
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
    redirect("/school/documents?notice=forbidden");
  }

  const licenseId=String(formData.get("license_id")??"").trim();
  const status=String(formData.get("status")??"");
  const reason=String(formData.get("rejection_reason")??"").trim();

  if(!licenseId||!["approved","rejected"].includes(status)||reason.length>500) {
    redirect("/school/documents?notice=invalid");
  }
  if(status==="rejected"&&!reason) redirect("/school/documents?notice=reason-required");

  const {error}=await supabase.rpc("review_student_permit",{
    p_license_id:licenseId,
    p_status:status,
    p_rejection_reason:status==="rejected"?reason:null
  });

  if(error) {
    const message=error.message.toLowerCase();
    if(message.includes("not found")) redirect("/school/documents?notice=record-missing");
    if(message.includes("already")) redirect("/school/documents?notice=already-reviewed");
    if(message.includes("role")) redirect("/school/documents?notice=forbidden");
    if(message.includes("archived")||message.includes("file path")) redirect("/school/documents?notice=document-missing");
    redirect("/school/documents?notice=review-error");
  }

  revalidatePath("/school");
  revalidatePath("/school/documents");
  revalidatePath("/student");
  redirect("/school/documents?notice=reviewed");
}
