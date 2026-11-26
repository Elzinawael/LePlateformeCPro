import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(value:string|null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/student";
}

export async function GET(request:NextRequest) {
  const code=request.nextUrl.searchParams.get("code");
  const destination=safeNext(request.nextUrl.searchParams.get("next"));

  if(!code) {
    return NextResponse.redirect(new URL("/login?error=invite-confirmation",request.url));
  }

  const supabase=await createSupabaseServerClient();
  const {error}=await supabase.auth.exchangeCodeForSession(code);

  if(error) {
    return NextResponse.redirect(new URL("/login?error=invite-confirmation",request.url));
  }

  return NextResponse.redirect(new URL(destination,request.url));
}
