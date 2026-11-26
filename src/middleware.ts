import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookies) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  if (request.nextUrl.pathname.startsWith("/school")) {
    const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle();
    const { data: membership } = await supabase.from("school_members").select("role,status").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    if (profile?.account_type !== "school" || !membership) return NextResponse.redirect(new URL("/student", request.url));
  }

  if (request.nextUrl.pathname.startsWith("/student")) {
    const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle();
    if (profile?.account_type !== "student") return NextResponse.redirect(new URL("/school", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/school/:path*", "/student/:path*"],
};
