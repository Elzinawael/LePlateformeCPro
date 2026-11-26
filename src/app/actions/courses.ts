"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function localDateTimeToIso(value:string,offset:number):string|null {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)||!Number.isInteger(offset)||Math.abs(offset)>840) return null;
  const sign=offset<=0?"+":"-";
  const abs=Math.abs(offset);
  const hours=String(Math.floor(abs/60)).padStart(2,"0");
  const minutes=String(abs%60).padStart(2,"0");
  const parsed=new Date(value+":00"+sign+hours+":"+minutes);
  return Number.isNaN(parsed.getTime())?null:parsed.toISOString();
}

export async function createTheorySession(formData:FormData):Promise<void> {
  const supabase=await createSupabaseServerClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user) redirect("/login");

  const {data:profile,error:profileError}=await supabase.from("profiles")
    .select("account_type").eq("id",user.id).maybeSingle();
  if(profileError||profile?.account_type!=="school") redirect("/login?error=school-access");

  const {data:membership,error:membershipError}=await supabase.from("school_members")
    .select("school_id,role").eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
  if(membershipError||!membership) redirect("/login?error=school-access");
  if(!["owner","admin","employee"].includes(membership.role)) redirect("/school/courses?notice=forbidden");

  const moduleId=String(formData.get("module_id")??"").trim();
  const title=String(formData.get("title")??"").trim();
  const startRaw=String(formData.get("start_at")??"").trim();
  const endRaw=String(formData.get("end_at")??"").trim();
  const location=String(formData.get("location")??"").trim();
  const capacity=Number(formData.get("capacity"));
  const timezoneOffset=Number(formData.get("timezone_offset"));

  if(!moduleId||title.length>120||location.length>200
    ||!Number.isInteger(capacity)||capacity<1||capacity>50) {
    redirect("/school/courses?notice=invalid");
  }

  const startAt=localDateTimeToIso(startRaw,timezoneOffset);
  const endAt=localDateTimeToIso(endRaw,timezoneOffset);
  if(!startAt||!endAt) redirect("/school/courses?notice=datetime-invalid");
  const startDate=new Date(startAt);
  const endDate=new Date(endAt);
  const duration=(endDate.getTime()-startDate.getTime())/60000;
  if(startDate<=new Date()||duration<30||duration>360) {
    redirect("/school/courses?notice=datetime-invalid");
  }

  const {data:module,error:moduleError}=await supabase
    .from("curriculum_modules")
    .select("id,name,module_number,is_active,phase:curriculum_phases!inner(id,phase_number,school_id,is_active)")
    .eq("id",moduleId)
    .maybeSingle();

  if(moduleError||!module||!module.is_active) redirect("/school/courses?notice=module-invalid");
  const phase=Array.isArray(module.phase)?module.phase[0]:module.phase;
  if(!phase||!phase.is_active||(phase.school_id!==null&&phase.school_id!==membership.school_id)) {
    redirect("/school/courses?notice=module-invalid");
  }

  const sessionTitle=title||"Module "+module.module_number+" · "+module.name;
  const {error:insertError}=await supabase.from("theory_courses").insert({
    school_id:membership.school_id,
    module_id:module.id,
    title:sessionTitle,
    start_at:startAt,
    end_at:endAt,
    capacity,
    location:location||null,
    status:"scheduled",
    created_by:user.id
  });

  if(insertError) redirect("/school/courses?notice=course-error");
  revalidatePath("/school/courses");
  revalidatePath("/school");
  redirect("/school/courses?notice=created");
}
