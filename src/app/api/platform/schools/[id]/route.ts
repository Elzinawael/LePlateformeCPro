import { NextRequest,NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function reply(message:string,status:number) {
  return NextResponse.json({message},{status,headers:{"Cache-Control":"no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff"}});
}

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const supabase=await createSupabaseServerClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)return reply("Session expirée.",401);
  const {data:platformAdmin,error:adminError}=await supabase.from("platform_admins")
    .select("user_id").eq("user_id",user.id).maybeSingle();
  if(adminError||!platformAdmin)return reply("Accès réservé à l'administration ConduiPRO.",403);

  const {id}=await params;
  let body:Record<string,unknown>;
  try{body=await request.json();}catch{return reply("Requête invalide.",400);}
  const status=body.status;
  if(!["active","suspended","archived"].includes(String(status)))return reply("Statut invalide.",400);

  try {
    const admin=createSupabaseAdminClient();
    const {data:school,error}=await admin.from("schools").update({status})
      .eq("id",id).select("id").maybeSingle();
    if(error||!school)return reply("L'école n'existe pas ou son statut n'a pas pu être modifié.",404);
    return reply(status==="active"?"L'école a été réactivée.":status==="suspended"?"L'école a été suspendue.":"L'école a été archivée.",200);
  }catch{return reply("La clé serveur Supabase n'est pas configurée.",503);}
}
