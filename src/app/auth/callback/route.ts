import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function safeNext(value:string|null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/student";
}

export async function GET(request:NextRequest) {
  const code=request.nextUrl.searchParams.get("code");
  const requestedNext=request.nextUrl.searchParams.get("next");
  const destination=requestedNext?safeNext(requestedNext):null;

  if(!code) {
    return NextResponse.redirect(new URL("/login?error=invite-confirmation",request.url));
  }

  const supabase=await createSupabaseServerClient();
  const {error}=await supabase.auth.exchangeCodeForSession(code);
  if(error) {
    return NextResponse.redirect(new URL("/login?error=invite-confirmation",request.url));
  }

  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(userError||!user) {
    return NextResponse.redirect(new URL("/login?error=invite-confirmation",request.url));
  }

  // A staff account becomes active only after the invited user proves access
  // to the invited email by completing the Supabase confirmation callback.
  try {
    const admin=createSupabaseAdminClient();
    const {data:pendingMembers,error:lookupError}=await admin
      .from("school_members")
      .select("id")
      .eq("user_id",user.id)
      .eq("status","invited");

    if(lookupError) throw lookupError;
    if(pendingMembers?.length) {
      const {error:activateError}=await admin.from("school_members")
        .update({status:"active"})
        .eq("user_id",user.id)
        .eq("status","invited");
      if(activateError) throw activateError;
    }
  } catch {
    return NextResponse.redirect(new URL("/login?error=membership-activation",request.url));
  }

  const passwordSetupUrl=destination
    ? "/auth/set-password?next="+encodeURIComponent(destination)
    : "/auth/set-password";
  return NextResponse.redirect(new URL(passwordSetupUrl,request.url));
}
