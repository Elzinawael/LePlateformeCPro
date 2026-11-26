import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ message, ...extra }, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" },
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return reply("Session expirée. Reconnectez-vous.", 401);

  const { data: platformAdmin, error: adminCheckError } = await supabase
    .from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (adminCheckError || !platformAdmin) return reply("Accès réservé à l'administration ConduiPRO.", 403);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return reply("Requête invalide.", 400); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const ownerFirstName = typeof body.ownerFirstName === "string" ? body.ownerFirstName.trim() : "";
  const ownerLastName = typeof body.ownerLastName === "string" ? body.ownerLastName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (!name || name.length > 160 || !ownerFirstName || ownerFirstName.length > 100
      || !ownerLastName || ownerLastName.length > 100
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
      || phone.length > 40) {
    return reply("Vérifiez le nom de l'école et les coordonnées du propriétaire.", 400);
  }

  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try { admin = createSupabaseAdminClient(); }
  catch { return reply("La clé serveur Supabase n'est pas configurée sur Hostinger.", 503); }

  const temporaryPassword = randomBytes(18).toString("base64url");
  const schoolCode = "CP-" + randomBytes(4).toString("hex").toUpperCase();
  let userId: string | null = null;
  let schoolId: string | null = null;

  try {
    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { first_name: ownerFirstName, last_name: ownerLastName, account_type: "school" },
    });
    if (createUserError || !createdUser.user) throw new Error(createUserError?.message ?? "Création du compte école impossible.");
    userId = createdUser.user.id;

    const { error: profileError } = await admin.from("profiles").insert({
      id: userId, first_name: ownerFirstName, last_name: ownerLastName, email, phone: phone || null, account_type: "school",
    });
    if (profileError) throw profileError;

    const { data: school, error: schoolError } = await admin.from("schools").insert({
      name, email, phone: phone || null, province: "Québec", school_code: schoolCode, status: "active",
    }).select("id").single();
    if (schoolError || !school) throw new Error(schoolError?.message ?? "Création de l'école impossible.");
    schoolId = school.id;

    const { error: membershipError } = await admin.from("school_members").insert({
      school_id: schoolId, user_id: userId, role: "owner", status: "active",
    });
    if (membershipError) throw membershipError;

    const { error: metadataError } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { must_change_password: true, account_type: "school", school_id: schoolId },
      user_metadata: { first_name: ownerFirstName, last_name: ownerLastName, account_type: "school", school_id: schoolId },
    });
    if (metadataError) throw metadataError;

    return reply("Compte école créé. Copiez les identifiants : le mot de passe ne sera plus affiché.", 201, {
      school: { id: schoolId, name, code: schoolCode, status: "active" },
      credentials: { email, password: temporaryPassword },
    });
  } catch (error) {
    if (schoolId) await admin.from("schools").delete().eq("id", schoolId);
    if (userId) {
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
    return reply("La création de l'école a échoué. Aucun compte partiel n'a été conservé.", 500, {
      detail: error instanceof Error ? error.message : "Erreur inconnue.",
    });
  }
}
