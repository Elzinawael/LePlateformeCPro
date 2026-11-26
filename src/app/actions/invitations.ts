"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function inviteStudent(formData:FormData):Promise<void> {
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
    redirect("/school/students?notice=forbidden");
  }

  const studentId=String(formData.get("student_id")??"").trim();
  if(!studentId) redirect("/school/students?notice=invite-error");

  const {data:student,error:studentError}=await supabase.from("students")
    .select("id,school_id,user_id,email,first_name,last_name,phone")
    .eq("id",studentId)
    .eq("school_id",membership.school_id)
    .maybeSingle();

  if(studentError||!student) redirect("/school/students?notice=invite-error");
  if(student.user_id) redirect("/school/students?notice=already-invited");
  if(!student.email) redirect("/school/students?notice=email-required");
  if(!process.env.APP_BASE_URL) redirect("/school/students?notice=invite-config");

  let admin;
  try {
    admin=createSupabaseAdminClient();
  } catch {
    redirect("/school/students?notice=invite-config");
  }

  const redirectUrl=new URL("/auth/callback?next=%2Fstudent",process.env.APP_BASE_URL).toString();
  const {data:invitation,error:invitationError}=await admin.auth.admin.inviteUserByEmail(
    student.email,
    {
      data:{
        first_name:student.first_name,
        last_name:student.last_name,
        account_type:"student",
        school_id:student.school_id,
        student_id:student.id,
      },
      redirectTo:redirectUrl,
    }
  );

  if(invitationError||!invitation.user) {
    redirect("/school/students?notice=invite-error");
  }

  const invitedUser=invitation.user;
  const {error:profileInsertError}=await admin.from("profiles").upsert({
    id:invitedUser.id,
    first_name:student.first_name,
    last_name:student.last_name,
    email:student.email,
    phone:student.phone,
    account_type:"student",
  },{onConflict:"id"});

  if(profileInsertError) {
    await admin.auth.admin.deleteUser(invitedUser.id);
    redirect("/school/students?notice=invite-error");
  }

  const {error:linkError}=await admin.from("students")
    .update({user_id:invitedUser.id})
    .eq("id",student.id)
    .eq("school_id",student.school_id)
    .is("user_id",null);

  if(linkError) {
    await admin.from("profiles").delete().eq("id",invitedUser.id);
    await admin.auth.admin.deleteUser(invitedUser.id);
    redirect("/school/students?notice=invite-error");
  }

  revalidatePath("/school/students");
  redirect("/school/students?notice=invite-sent");
}
