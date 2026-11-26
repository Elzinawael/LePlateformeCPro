import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { makeInitialStudentPassword, makeStudentLoginEmail } from "@/lib/auth/identifiers";

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

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("account_type").eq("id", user.id).maybeSingle();
  if (profileError || profile?.account_type !== "school") return reply("Accès réservé à une école.", 403);

  const { data: membership, error: membershipError } = await supabase.from("school_members")
    .select("school_id,role").eq("user_id", user.id).eq("status", "active").eq("role", "owner").maybeSingle();
  if (membershipError || !membership) return reply("Aucun accès administrateur actif à cette école.", 403);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return reply("Requête invalide.", 400); }
  const contractNumber = typeof body.contractNumber === "string" ? body.contractNumber.trim() : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const dateOfBirth = typeof body.dateOfBirth === "string" ? body.dateOfBirth.trim() : "";

  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{4,39}$/.test(contractNumber)
      || !firstName || firstName.length > 100
      || !lastName || lastName.length > 100
      || (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254))
      || phone.length > 40
      || (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth))) {
    return reply("Vérifiez le numéro de contrat et les informations de l'élève.", 400);
  }

  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try { admin = createSupabaseAdminClient(); }
  catch { return reply("La clé serveur Supabase n'est pas configurée sur Hostinger.", 503); }

  const { data: school, error: schoolError } = await admin.from("schools")
    .select("id,name,school_code,status").eq("id", membership.school_id).maybeSingle();
  if (schoolError || !school || school.status !== "active") return reply("L'école est introuvable ou suspendue.", 403);

  const { data: duplicate, error: duplicateError } = await admin.from("students")
    .select("id").eq("school_id", school.id).eq("contract_number", contractNumber).maybeSingle();
  if (duplicateError) return reply("Impossible de vérifier le numéro de contrat.", 503);
  if (duplicate) return reply("Ce numéro de contrat existe déjà dans votre école.", 409);

  let loginEmail: string;
  let password: string;
  try {
    loginEmail = makeStudentLoginEmail(school.school_code, contractNumber);
    password = makeInitialStudentPassword(contractNumber);
  } catch {
    return reply("Le code de l'école ou le numéro de contrat est invalide.", 400);
  }

  let studentUserId: string | null = null;
  let studentId: string | null = null;
  try {
    const { data: authData, error: authCreateError } = await admin.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName, account_type: "student" },
    });
    if (authCreateError || !authData.user) throw new Error(authCreateError?.message ?? "Création du compte élève impossible.");
    studentUserId = authData.user.id;

    const { error: profileCreateError } = await admin.from("profiles").insert({
      id: studentUserId,
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      phone: phone || null,
      account_type: "student",
    });
    if (profileCreateError) throw profileCreateError;

    const { data: phaseOne, error: phaseError } = await admin.from("curriculum_phases")
      .select("id").eq("is_active", true).eq("phase_number", 1)
      .or(`school_id.eq.${school.id},school_id.is.null`)
      .order("school_id", { ascending: false, nullsFirst: false })
      .limit(1).maybeSingle();
    if (phaseError || !phaseOne) throw new Error("La phase 1 du programme SAAQ n'est pas configurée.");

    const { data: student, error: studentInsertError } = await admin.from("students").insert({
      school_id: school.id,
      user_id: studentUserId,
      contract_number: contractNumber,
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      phone: phone || null,
      date_of_birth: dateOfBirth || null,
      created_by: user.id,
      current_phase_id: phaseOne.id,
      status: "active",
    }).select("id").single();
    if (studentInsertError || !student) throw new Error(studentInsertError?.message ?? "Création du dossier élève impossible.");
    studentId = student.id;

    const { error: metadataError } = await admin.auth.admin.updateUserById(studentUserId, {
      app_metadata: {
        must_change_password: true,
        account_type: "student",
        school_id: school.id,
        student_id: studentId,
        school_code: school.school_code,
      },
      user_metadata: { first_name: firstName, last_name: lastName, account_type: "student", school_id: school.id, student_id: studentId },
    });
    if (metadataError) throw metadataError;

    return reply("Dossier et compte élève créés. Remettez les identifiants à l'élève de manière sécurisée.", 201, {
      student: { id: studentId, contractNumber, firstName, lastName, email: email || null, phase: 1 },
      credentials: { schoolCode: school.school_code, contractNumber, password },
    });
  } catch (error) {
    if (studentId) await admin.from("students").delete().eq("id", studentId);
    if (studentUserId) {
      await admin.from("profiles").delete().eq("id", studentUserId);
      await admin.auth.admin.deleteUser(studentUserId);
    }
    return reply("La création de l'élève a échoué. Aucun compte partiel n'a été conservé.", 500, {
      detail: error instanceof Error ? error.message : "Erreur inconnue.",
    });
  }
}
