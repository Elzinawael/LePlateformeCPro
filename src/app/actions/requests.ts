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
    .select("school_id,role").eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
  if(membershipError||!membership) redirect("/login?error=school-access");
  if(!["owner","admin","employee"].includes(membership.role)) {
    redirect("/school/requests?notice=forbidden");
  }

  const requestId=String(formData.get("request_id")??"").trim();
  const nextStatus=String(formData.get("status")??"");
  const response=String(formData.get("school_response")??"").trim();

  if(!requestId||!["processing","approved","rejected"].includes(nextStatus)||response.length>1000) {
    redirect("/school/requests?notice=invalid");
  }

  const {data:request,error:requestError}=await supabase.from("course_requests")
    .select("id,school_id,student_id,request_type,module_id,practical_lesson_id,preferred_course_id,status")
    .eq("id",requestId).eq("school_id",membership.school_id).maybeSingle();
  if(requestError||!request) redirect("/school/requests?notice=request-missing");
  if(!["submitted","processing"].includes(request.status)) {
    redirect("/school/requests?notice=request-closed");
  }
  if(nextStatus==="rejected"&&!response) {
    redirect("/school/requests?notice=response-required");
  }

  if(nextStatus==="approved"&&request.request_type==="theory") {
    if(!request.preferred_course_id) redirect("/school/requests?notice=course-required");

    const {data:course,error:courseError}=await supabase.from("theory_courses")
      .select("id,school_id,module_id,start_at,capacity,status")
      .eq("id",request.preferred_course_id)
      .eq("school_id",membership.school_id)
      .eq("module_id",request.module_id)
      .maybeSingle();
    if(courseError||!course||course.status!=="scheduled"||new Date(course.start_at)<=new Date()) {
      redirect("/school/requests?notice=session-unavailable");
    }

    const [{count:enrollmentCount,error:countError},{data:existing,error:existingError}]=await Promise.all([
      supabase.from("theory_course_enrollments").select("id",{count:"exact",head:true})
        .eq("course_id",course.id),
      supabase.from("theory_course_enrollments").select("id")
        .eq("course_id",course.id).eq("student_id",request.student_id).maybeSingle()
    ]);
    if(countError||existingError) redirect("/school/requests?notice=enrollment-error");
    if(!existing&&(enrollmentCount??0)>=course.capacity) {
      redirect("/school/requests?notice=session-full");
    }

    if(!existing) {
      const {error:enrollError}=await supabase.from("theory_course_enrollments").insert({
        school_id:membership.school_id,
        student_id:request.student_id,
        course_id:course.id,
        status:"enrolled"
      });
      if(enrollError) redirect("/school/requests?notice=enrollment-error");
    }
  }

  if(nextStatus==="approved"&&request.request_type==="practical"&&!response) {
    redirect("/school/requests?notice=response-required");
  }

  const {error:updateError}=await supabase.from("course_requests")
    .update({
      status:nextStatus,
      school_response:response||null,
      processed_by:nextStatus==="processing"?null:user.id,
      processed_at:nextStatus==="processing"?null:new Date().toISOString()
    })
    .eq("id",request.id)
    .eq("school_id",membership.school_id)
    .in("status",["submitted","processing"]);

  if(updateError) redirect("/school/requests?notice=update-error");

  revalidatePath("/school");
  revalidatePath("/school/requests");
  revalidatePath("/student");
  redirect("/school/requests?notice=updated");
}
