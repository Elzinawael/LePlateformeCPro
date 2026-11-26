"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function inviteStaffMember(formData:FormData):Promise<void> {
  const supabase=await createSupabaseServerClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user) redirect("/login");

  const {data:profile,error:profileError}=await supabase.from("profiles")
    .select("account_type").eq("id",user.id).maybeSingle();
  if(profileError||profile?.account_type!=="school") redirect("/login?error=school-access");

  const {data:membership,error:membershipError}=await supabase.from("school_members")
    .select("school_id,role").eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
  if(membershipError||!membership) redirect("/login?error=school-access");
  if(!["owner","admin"].includes(membership.role)) redirect("/school/instructors?notice=forbidden");

  const email=String(formData.get("email")??"").trim().toLowerCase();
  const firstName=String(formData.get("first_name")??"").trim();
  const lastName=String(formData.get("last_name")??"").trim();
  const role=String(formData.get("role")??"");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254
    ||!firstName||firstName.length>100||!lastName||lastName.length>100
    ||!["admin","employee","instructor"].includes(role)) {
    redirect("/school/instructors?notice=staff-invalid");
  }
  if(membership.role==="admin"&&role==="admin") {
    redirect("/school/instructors?notice=staff-role-denied");
  }
  if(!process.env.APP_BASE_URL) redirect("/school/instructors?notice=staff-config");

  let admin;
  try { admin=createSupabaseAdminClient(); }
  catch { redirect("/school/instructors?notice=staff-config"); }

  const redirectTo=new URL("/auth/callback?next=%2Fschool",process.env.APP_BASE_URL).toString();
  const {data:invitation,error:inviteError}=await admin.auth.admin.inviteUserByEmail(email,{
    data:{
      first_name:firstName,
      last_name:lastName,
      account_type:"school",
      school_id:membership.school_id,
      role
    },
    redirectTo
  });
  if(inviteError||!invitation.user) redirect("/school/instructors?notice=staff-invite-error");

  const invitedUser=invitation.user;
  const {error:profileInsertError}=await admin.from("profiles").upsert({
    id:invitedUser.id,
    first_name:firstName,
    last_name:lastName,
    email,
    account_type:"school"
  },{onConflict:"id"});
  if(profileInsertError) {
    await admin.auth.admin.deleteUser(invitedUser.id);
    redirect("/school/instructors?notice=staff-invite-error");
  }

  const {error:memberError}=await admin.from("school_members").insert({
    school_id:membership.school_id,
    user_id:invitedUser.id,
    role,
    status:"active"
  });
  if(memberError) {
    await admin.from("profiles").delete().eq("id",invitedUser.id);
    await admin.auth.admin.deleteUser(invitedUser.id);
    redirect("/school/instructors?notice=staff-invite-error");
  }

  revalidatePath("/school/instructors");
  revalidatePath("/school");
  redirect("/school/instructors?notice=staff-invited");
}
