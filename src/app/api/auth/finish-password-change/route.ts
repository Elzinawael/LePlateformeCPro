import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ message: "Session expirée." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (user.app_metadata?.must_change_password !== true) {
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const admin = createSupabaseAdminClient();
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, must_change_password: false },
    });
    if (updateError) throw updateError;
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw refreshError;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "Le mot de passe a été modifié, mais le compte doit encore être activé. Réessayez." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
