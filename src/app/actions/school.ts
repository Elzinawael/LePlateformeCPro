"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function createStudent(formData: FormData): Promise<void> {
  const supabase=await createSupabaseServerClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user) redirect("/login");

  const {data:profile,error:profileError}=await supabase.from("profiles")
    .select("account_type").eq("id",user.id).maybeSingle();
  if(profileError||profile?.account_type!=="school") redirect("/login?error=school-access");

  const {data:membership,error:membershipError}=await supabase.from("school_members")
    .select("school_id,role").eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
  if(membershipError||!membership) redirect("/login?error=school-access");
  if(!["owner","admin","employee"].includes(membership.role)) redirect("/school/students?notice=forbidden");

  const contractNumber=String(formData.get("contract_number")??"").trim();
  const firstName=String(formData.get("first_name")??"").trim();
  const lastName=String(formData.get("last_name")??"").trim();
  const email=String(formData.get("email")??"").trim().toLowerCase();
  const phone=String(formData.get("phone")??"").trim();
  const dateOfBirth=String(formData.get("date_of_birth")??"").trim();

  if(!/^[A-Za-z0-9][A-Za-z0-9._/-]{1,39}$/.test(contractNumber)
    ||!firstName||firstName.length>100
    ||!lastName||lastName.length>100
    ||email.length>254
    ||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ||phone.length>40) {
    redirect("/school/students?notice=student-invalid");
  }
  if(dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    redirect("/school/students?notice=student-invalid");
  }

  const {data:duplicate,error:duplicateError}=await supabase.from("students")
    .select("id").eq("school_id",membership.school_id).eq("contract_number",contractNumber).maybeSingle();
  if(duplicateError) redirect("/school/students?notice=student-error");
  if(duplicate) redirect("/school/students?notice=contract-exists");

  const {error:insertError}=await supabase.from("students").insert({
    school_id:membership.school_id,
    contract_number:contractNumber,
    first_name:firstName,
    last_name:lastName,
    email:email||null,
    phone:phone||null,
    date_of_birth:dateOfBirth||null,
    created_by:user.id,
    status:"active",
  });

  if(insertError) redirect("/school/students?notice=student-error");

  revalidatePath("/school");
  revalidatePath("/school/students");
  redirect("/school/students?notice=student-created");
}
