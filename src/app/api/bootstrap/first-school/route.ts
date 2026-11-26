import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    { message, ...extra },
    {
      status,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const expectedToken = process.env.CONDUIPRO_BOOTSTRAP_TOKEN;
  if (!expectedToken || expectedToken.length < 32) {
    return json("L'initialisation du premier compte est désactivée sur le serveur.", 404);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json("Requête invalide.", 400);
  }

  const token = typeof body.token === "string" ? body.token : "";
  if (!safeEqual(token, expectedToken)) {
    return json("Code d'initialisation invalide.", 401);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const schoolName = typeof body.schoolName === "string" ? body.schoolName.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !firstName ||
    firstName.length > 100 ||
    !lastName ||
    lastName.length > 100 ||
    !schoolName ||
    schoolName.length > 160 ||
    password.length < 12 ||
    password.length > 128
  ) {
    return json("Vérifie le courriel, les noms, le nom de l'école et le mot de passe (12 caractères minimum).", 400);
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return json("La clé secrète Supabase n'est pas configurée côté serveur.", 503);
  }

  // The first-school bootstrap is only allowed while the application is truly empty.
  const [{ count: schoolCount, error: schoolCountError }, { count: memberCount, error: memberCountError }] =
    await Promise.all([
      admin.from("schools").select("id", { count: "exact", head: true }),
      admin.from("school_members").select("id", { count: "exact", head: true }),
    ]);

  if (schoolCountError || memberCountError) {
    return json("Impossible de vérifier l'état initial de la base.", 503);
  }
  if ((schoolCount ?? 0) > 0 || (memberCount ?? 0) > 0) {
    return json("Une école ou un membre existe déjà. L'initialisation unique est verrouillée.", 409);
  }

  let userId: string | null = null;
  let schoolId: string | null = null;

  try {
    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        account_type: "school",
        role: "owner",
      },
    });

    if (createUserError || !createdUser.user) {
      throw new Error(createUserError?.message ?? "La création du compte Supabase a échoué.");
    }
    userId = createdUser.user.id;

    const { data: school, error: createSchoolError } = await admin
      .from("schools")
      .insert({
        name: schoolName,
        email,
        province: "Québec",
        status: "active",
      })
      .select("id")
      .single();

    if (createSchoolError || !school) {
      throw new Error(createSchoolError?.message ?? "La création de l'école a échoué.");
    }
    schoolId = school.id;

    const { error: updateAuthError } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        account_type: "school",
        role: "owner",
        school_id: schoolId,
      },
    });
    if (updateAuthError) throw updateAuthError;

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userId,
        first_name: firstName,
        last_name: lastName,
        email,
        account_type: "school",
      },
      { onConflict: "id" }
    );
    if (profileError) throw profileError;

    const { error: membershipError } = await admin.from("school_members").insert({
      school_id: schoolId,
      user_id: userId,
      role: "owner",
      status: "active",
    });
    if (membershipError) throw membershipError;

    return json("Le compte propriétaire et l'école de test ont été créés.", 201, {
      email,
      schoolName,
      redirectTo: "/login?bootstrap=success",
    });
  } catch (error) {
    // Best-effort rollback so a partial bootstrap does not leave the database unusable.
    if (schoolId && userId) {
      await admin.from("school_members").delete().eq("school_id", schoolId).eq("user_id", userId);
    }
    if (schoolId) {
      await admin.from("schools").delete().eq("id", schoolId);
    }
    if (userId) {
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
    }

    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    return json("La création a échoué. Aucune configuration partielle ne doit être conservée.", 500, {
      detail: message,
    });
  }
}
