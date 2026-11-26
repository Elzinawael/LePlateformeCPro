import { createClient } from "@supabase/supabase-js";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
const secretKey = required("SUPABASE_SECRET_KEY");
const appBaseUrl = required("APP_BASE_URL");
const schoolName = required("BOOTSTRAP_SCHOOL_NAME");
const ownerEmail = required("BOOTSTRAP_OWNER_EMAIL").toLowerCase();
const ownerFirstName = required("BOOTSTRAP_OWNER_FIRST_NAME");
const ownerLastName = required("BOOTSTRAP_OWNER_LAST_NAME");

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
  throw new Error("BOOTSTRAP_OWNER_EMAIL is not a valid email address.");
}

const admin = createClient(supabaseUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const redirectTo = new URL(
  "/auth/callback?next=%2Fschool",
  appBaseUrl
).toString();

let invitedUserId = null;
let schoolId = null;

try {
  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(ownerEmail, {
      data: {
        first_name: ownerFirstName,
        last_name: ownerLastName,
        account_type: "school",
        role: "owner",
      },
      redirectTo,
    });

  if (inviteError || !invited.user) {
    throw inviteError ?? new Error("Supabase did not return an invited user.");
  }
  invitedUserId = invited.user.id;

  const { data: school, error: schoolError } = await admin
    .from("schools")
    .insert({
      name: schoolName,
      legal_name: process.env.BOOTSTRAP_SCHOOL_LEGAL_NAME?.trim() || null,
      email: ownerEmail,
      phone: process.env.BOOTSTRAP_SCHOOL_PHONE?.trim() || null,
      address: process.env.BOOTSTRAP_SCHOOL_ADDRESS?.trim() || null,
      city: process.env.BOOTSTRAP_SCHOOL_CITY?.trim() || null,
      province: process.env.BOOTSTRAP_SCHOOL_PROVINCE?.trim() || "Québec",
      postal_code: process.env.BOOTSTRAP_SCHOOL_POSTAL_CODE?.trim() || null,
      status: "active",
    })
    .select("id")
    .single();

  if (schoolError || !school) {
    throw schoolError ?? new Error("School record could not be created.");
  }
  schoolId = school.id;

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: invitedUserId,
      first_name: ownerFirstName,
      last_name: ownerLastName,
      email: ownerEmail,
      account_type: "school",
    },
    { onConflict: "id" }
  );

  if (profileError) throw profileError;

  const { error: memberError } = await admin.from("school_members").insert({
    school_id: schoolId,
    user_id: invitedUserId,
    role: "owner",
    status: "invited",
  });

  if (memberError) throw memberError;

  console.log("School created and owner invitation sent.");
  console.log(`School ID: ${schoolId}`);
  console.log(`Owner email: ${ownerEmail}`);
  console.log("The owner must open the invitation email and set a password.");
} catch (error) {
  if (invitedUserId) {
    if (schoolId) {
      await admin.from("school_members").delete()
        .eq("school_id", schoolId).eq("user_id", invitedUserId);
      await admin.from("schools").delete().eq("id", schoolId);
    }
    await admin.from("profiles").delete().eq("id", invitedUserId);
    await admin.auth.admin.deleteUser(invitedUserId);
  }
  console.error("Bootstrap failed. Any partial records were cleaned up where possible.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
