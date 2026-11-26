import { redirect } from "next/navigation";
import { CarFront, School, Users, LogOut } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/app/actions/auth";
import SchoolProvisioningForm from "./SchoolProvisioningForm";

export const dynamic="force-dynamic";

type SchoolRow={id:string;name:string;school_code:string;email:string|null;status:string;created_at:string};

export default async function PlatformAdminPage() {
  const supabase=await createSupabaseServerClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)redirect("/login");
  const {data:admin}=await supabase.from("platform_admins").select("user_id").eq("user_id",user.id).maybeSingle();
  if(!admin)redirect("/school");

  const service=createSupabaseAdminClient();
  const [{data:schools,error:schoolsError},{count:studentCount},{count:ownerCount}]=await Promise.all([
    service.from("schools").select("id,name,school_code,email,status,created_at").order("created_at",{ascending:false}),
    service.from("students").select("id",{count:"exact",head:true}),
    service.from("school_members").select("id",{count:"exact",head:true}).eq("role","owner").eq("status","active")
  ]);
  const rows=(schools??[]) as SchoolRow[];
  const schoolIds=rows.map(s=>s.id);
  const {data:members}=schoolIds.length?await service.from("school_members").select("school_id,user_id").in("school_id",schoolIds).eq("role","owner").eq("status","active"):{data:[]};
  const ownerIds=(members??[]).map(m=>m.user_id);
  const {data:profiles}=ownerIds.length?await service.from("profiles").select("id,first_name,last_name,email").in("id",ownerIds):{data:[]};
  const owners=new Map((profiles??[]).map(p=>[p.id,[p.first_name,p.last_name].filter(Boolean).join(" ")||p.email||"Propriétaire"]));
  const ownerBySchool=new Map((members??[]).map(m=>[m.school_id,owners.get(m.user_id)??"Propriétaire"]));

  return <main className="admin-shell">
    <header className="students-admin-header">
      <a className="students-brand" href="/admin"><span className="brand-mark"><CarFront size={20}/></span><span><strong>ConduiPRO</strong><small>ADMINISTRATION PLATEFORME</small></span></a>
      <div className="students-head-right"><span>Administration ConduiPRO</span><form action={signOut}><button className="student-logout" type="submit"><LogOut size={15}/> Déconnexion</button></form></div>
    </header>
    <section className="admin-content">
      <div className="students-page-heading"><div><p className="hero-kicker">ESPACE ADMINISTRATEUR</p><h1>Gestion des écoles</h1><p>Crée les accès des écoles clientes et consulte l'activité globale de ConduiPRO.</p></div><div className="students-total"><School size={18}/><strong>{rows.length}</strong><small>écoles</small></div></div>
      <div className="metric-grid">
        <article className="metric-card"><div className="metric-icon blue"><School size={19}/></div><p>Écoles</p><strong>{rows.length}</strong><small>Établissements enregistrés</small></article>
        <article className="metric-card"><div className="metric-icon violet"><Users size={19}/></div><p>Élèves</p><strong>{studentCount.count??0}</strong><small>Dossiers sur la plateforme</small></article>
        <article className="metric-card"><div className="metric-icon green"><Users size={19}/></div><p>Comptes école</p><strong>{ownerCount.count??0}</strong><small>Propriétaires actifs</small></article>
      </div>
      <SchoolProvisioningForm/>
      <section className="students-list-panel">
        <div className="panel-head"><div><h2>Écoles enregistrées</h2><p>Chaque école possède un code distinct pour connecter ses élèves.</p></div><School size={19}/></div>
        {schoolsError?<p className="student-notice" role="alert">Impossible de charger les écoles.</p>:rows.length===0?<p className="empty-state">Aucune école créée.</p>:<div className="students-table-wrap"><table className="students-table">
          <thead><tr><th>École</th><th>Code école</th><th>Propriétaire</th><th>Courriel</th><th>État</th><th>Création</th></tr></thead>
          <tbody>{rows.map(s=><tr key={s.id}><td><strong>{s.name}</strong></td><td><code>{s.school_code}</code></td><td>{ownerBySchool.get(s.id)??"—"}</td><td>{s.email??"—"}</td><td><span className={s.status==="active"?"account-active":"account-pending"}>{s.status==="active"?"Active":s.status}</span></td><td>{new Intl.DateTimeFormat("fr-CA",{day:"numeric",month:"short",year:"numeric",timeZone:"America/Toronto"}).format(new Date(s.created_at))}</td></tr>)}</tbody>
        </table></div>}
      </section>
      <footer className="portal-footer"><span>© 2026 ConduiPRO</span><span>Administration sécurisée de la plateforme</span></footer>
    </section>
  </main>;
}
