import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function redirectWithCookies(request:NextRequest,destination:string,response:NextResponse) {
  const redirected=NextResponse.redirect(new URL(destination,request.url));
  response.cookies.getAll().forEach(({name,value,...options})=>redirected.cookies.set(name,value,options));
  redirected.headers.set("Cache-Control","private, no-store");
  return redirected;
}

export async function middleware(request:NextRequest) {
  let response=NextResponse.next({request});
  response.headers.set("Cache-Control","private, no-store");

  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key) return redirectWithCookies(request,"/login?error=configuration",response);

  const supabase=createServerClient(url,key,{
    cookies:{
      getAll(){return request.cookies.getAll();},
      setAll(cookiesToSet,headers){
        cookiesToSet.forEach(({name,value})=>request.cookies.set(name,value));
        response=NextResponse.next({request});
        cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options));
        Object.entries(headers).forEach(([name,value])=>response.headers.set(name,value));
        response.headers.set("Cache-Control","private, no-store");
      }
    }
  });

  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user) {
    const login=new URL("/login",request.url);
    login.searchParams.set("next",request.nextUrl.pathname);
    return redirectWithCookies(request,login.pathname+login.search,response);
  }

  const pathname=request.nextUrl.pathname;
  if(user.app_metadata?.must_change_password===true && !pathname.startsWith("/auth/set-password")) {
    const destination="/auth/set-password?next="+encodeURIComponent(pathname);
    return redirectWithCookies(request,destination,response);
  }

  const {data:profile,error:profileError}=await supabase.from("profiles")
    .select("account_type").eq("id",user.id).maybeSingle();
  if(profileError||!profile) return redirectWithCookies(request,"/login?error=profile",response);

  if(pathname.startsWith("/admin")) {
    const {data:platformAdmin,error:adminError}=await supabase.from("platform_admins")
      .select("user_id").eq("user_id",user.id).maybeSingle();
    if(adminError||!platformAdmin) {
      return redirectWithCookies(request,profile.account_type==="student"?"/student":"/school",response);
    }
    return response;
  }

  if(pathname.startsWith("/school")) {
    if(profile.account_type!=="school") return redirectWithCookies(request,"/student",response);
    const {data:membership,error:membershipError}=await supabase.from("school_members")
      .select("school_id,role").eq("user_id",user.id).eq("status","active").eq("role","owner").maybeSingle();
    if(membershipError||!membership) return redirectWithCookies(request,"/login?error=school-access",response);
    const {data:school,error:schoolError}=await supabase.from("schools").select("status").eq("id",membership.school_id).maybeSingle();
    if(schoolError||!school||school.status!=="active") return redirectWithCookies(request,"/login?error=school-suspended",response);
  }

  if(pathname.startsWith("/student")) {
    if(profile.account_type!=="student") return redirectWithCookies(request,"/admin",response);
    const {data:student,error:studentError}=await supabase.from("students")
      .select("id,school_id").eq("user_id",user.id).maybeSingle();
    if(studentError||!student) return redirectWithCookies(request,"/login?error=student-access",response);
    const {data:school,error:schoolError}=await supabase.from("schools").select("status").eq("id",student.school_id).maybeSingle();
    if(schoolError||!school||school.status!=="active") return redirectWithCookies(request,"/login?error=school-suspended",response);
  }

  return response;
}

export const config={matcher:["/admin/:path*","/school/:path*","/student/:path*"]};
