"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function processCourseRequest(formData:FormData):Promise<void> {
  const supabase=await createSupabaseServerClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user) redirect("/login");

  const {data:profile,error:profileError}=await supabase.from("profiles")
    .select("account_type").eq("id",user.id).maybeSingle();
  if(profileError||profile?.account_type!=="school") redirect("/login?error=school-access");

  const {data:membership,error:membershipError}=await supabase.from("school_members")
    .select("school_id,role").eq("user_id",user.id).eq("status","active").eq("role","owner").maybeSingle();
  if(membershipError||!membership) redirect("/login?error=school-access");
  if(membership.role!=="owner") redirect("/school/requests?notice=forbidden");

  const requestId=String(formData.get("request_id")??"").trim();
  const nextStatus=String(formData.get("status")??"");
  const response=String(formData.get("school_response")??"").trim();
  if(!requestId||!["processing","approved","rejected"].includes(nextStatus)||response.length>1000) {
    redirect("/school/requests?notice=invalid");
  }

  const {error}=await supabase.rpc("process_course_request",{
    p_request_id:requestId,
    p_status:nextStatus,
    p_school_response:response||null
  });

  if(error) {
    const message=error.message.toLowerCase();
    if(message.includes("full")) redirect("/school/requests?notice=session-full");
    if(message.includes("session")||message.includes("selected session")) redirect("/school/requests?notice=session-unavailable");
    if(message.includes("response is required")) redirect("/school/requests?notice=response-required");
    if(message.includes("closed")) redirect("/school/requests?notice=request-closed");
    if(message.includes("not found")) redirect("/school/requests?notice=request-missing");
    if(message.includes("role")) redirect("/school/requests?notice=forbidden");
    redirect("/school/requests?notice=update-error");
  }

  revalidatePath("/school");
  revalidatePath("/school/requests");
  revalidatePath("/student");
  redirect("/school/requests?notice=updated");
}
