import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function redirectWithCookies(
  request: NextRequest,
  destination: string,
  response: NextResponse
) {
  const redirectResponse = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.getAll().forEach(({ name, value, ...options }) => {
    redirectResponse.cookies.set(name, value, options);
  });
  redirectResponse.headers.set("Cache-Control", "private, no-store");
  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fail closed: protected portal pages must never render without Supabase config.
  if (!url || !key) {
    return redirectWithCookies(request, "/login?error=configuration", response);
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });

  // Validate the session with Supabase Auth before reading protected data.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return redirectWithCookies(request, login.pathname + login.search, response);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return redirectWithCookies(request, "/login?error=profile", response);
  }

  if (request.nextUrl.pathname.startsWith("/school")) {
    if (profile.account_type !== "school") {
      return redirectWithCookies(request, "/student", response);
    }

    const { data: membership, error: membershipError } = await supabase
      .from("school_members")
      .select("school_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership) {
      return redirectWithCookies(request, "/login?error=school-access", response);
    }
  }

  if (request.nextUrl.pathname.startsWith("/student")) {
    if (profile.account_type !== "student") {
      return redirectWithCookies(request, "/school", response);
    }

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (studentError || !student) {
      return redirectWithCookies(request, "/login?error=student-access", response);
    }
  }

  return response;
}

export const config = {
  matcher: ["/school/:path*", "/student/:path*"],
};
