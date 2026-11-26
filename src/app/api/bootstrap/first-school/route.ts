import { NextResponse } from "next/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST() {
  return NextResponse.json(
    { message: "Cette procédure de bootstrap est désactivée. Utilisez l’administration ConduiPRO pour créer les écoles." },
    { status: 410, headers: { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" } }
  );
}
