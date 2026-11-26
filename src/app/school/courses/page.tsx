import { ArrowLeft,BookOpen,CalendarClock,CarFront,MapPin,Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TheorySessionForm } from "./TheorySessionForm";

export const dynamic="force-dynamic";

type ModuleRow={id:string;name:string;module_number:number;phase_number:number};
type CourseRow={id:string;title:string;start_at:string;end_at:string;capacity:number;location:string|null;module_id:string;status:string;module:{name:string;module_number:number;phase:{phase_number:number}}|null};
const notices:Record<string,string>={
 created:"La séance théorique a été créée et est disponible aux élèves de la phase correspondante.",
 forbidden:"Votre rôle ne permet pas de créer une séance.",
 invalid:"Vérifiez le module, la capacité et les informations saisies.",
 "datetime-invalid":"La date doit être future et la durée comprise entre 30 minutes et 6 heures.",
 "module-invalid":"Ce module ne fait pas partie du programme actif de votre établissement.",
 "course-error":"La séance n’a pas pu être créée. Vérifiez les données et réessayez."
};

function dateTime(value:string) {
 return new Intl.DateTimeFormat("fr-CA",{weekday:"long",day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"America/Toronto"}).format(new Date(value));
}
function time(value:string) {
 return new Intl.DateTimeFormat("fr-CA",{hour:"2-digit",minute:"2-digit",timeZone:"America/Toronto"}).format(new Date(value));
}

export default async function CoursesPage({searchParams}:{searchParams:Promise<{notice?:string}>}) {
 const params=await searchParams;
 const supabase=await createSupabaseServerClient();
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user) redirect("/login");
 const {data:profile,error:profileError}=await supabase.from("profiles").select("account_type").eq("id",user.id).maybeSingle();
 if(profileError||profile?.account_type!=="school") redirect("/login?error=school-access");
 const {data:membership,error:membershipError}=await supabase.from("school_members").select("school_id,role").eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
 if(membershipError||!membership) redirect("/login?error=school-access");

 const [{data:school},{data:schoolPhases},{data:globalPhases},{data:courses},{data:enrollments}] = await Promise.all([
  supabase.from("schools").select("name").eq("id",membership.school_id).maybeSingle(),
  supabase.from("curriculum_phases").select("id,phase_number").eq("school_id",membership.school_id).eq("is_active",true),
  supabase.from("curriculum_phases").select("id,phase_number").is("school_id",null).eq("is_active",true),
  supabase.from("theory_courses").select("id,title,start_at,end_at,capacity,location,module_id,status,module:curriculum_modules(name,module_number,phase:curriculum_phases(phase_number))").eq("school_id",membership.school_id).order("start_at").limit(100),
  supabase.from("theory_course_enrollments").select("course_id,status").eq("school_id",membership.school_id).eq("status","enrolled")
 ]);
 const phases=[...(schoolPhases??[]),...(globalPhases??[])];
 const phaseIds=[...new Set(phases.map((p)=>p.id))];
 const [{data:rawModules},{data:rawModuleData}]=phaseIds.length?await Promise.all([
  supabase.from("curriculum_modules").select("id,name,module_number,phase_id,is_active").in("phase_id",phaseIds).eq("is_active",true).order("module_number"),
  supabase.from("curriculum_modules").select("id,name,module_number,phase_id").in("phase_id",phaseIds).eq("is_active",true).order("module_number")
 ]):[{data:[]},{data:[]}];
 const selectedModules=(rawModules??[]).map(m=>{
  const phase=phases.find(p=>p.id===m.phase_id);
  return {id:m.id,name:m.name,module_number:m.module_number,phase_number:phase?.phase_number??0};
 }) as ModuleRow[];
 const moduleData=(rawModuleData??[]);
 const sessions=(courses??[]) as unknown as CourseRow[];
 const counts=new Map<string,number>();
 (enrollments??[]).forEach(e=>counts.set(e.course_id,(counts.get(e.course_id)??0)+1));
 const canManage=["owner","admin","employee"].includes(membership.role);
 const notice=params.notice?notices[params.notice]:null;
 const now=Date.now();
 const upcoming=sessions.filter(s=>s.status==="scheduled"&&new Date(s.start_at).getTime()>now);
 return <main className="courses-shell">
  <header className="students-admin-header">
   <a className="students-brand" href="/school"><span className="brand-mark"><CarFront size={20}/></span><span><strong>ConduiPRO</strong><small>PORTAIL ÉCOLE</small></span></a>
   <div className="students-head-right"><span>{school?.name??"Votre école"}</span><a href="/school"><ArrowLeft size={15}/> Tableau de bord</a></div>
  </header>
  <section className="courses-content">
   <div className="students-page-heading"><div><p className="hero-kicker">GESTION DE LA FORMATION</p><h1>Cours théoriques</h1><p>Planifiez les séances que les élèves de la phase correspondante pourront demander.</p></div><div className="students-total"><CalendarClock size={18}/><strong>{upcoming.length}</strong><small>à venir</small></div></div>
   {notice&&<div className="student-notice" role="status">{notice}</div>}
   {canManage&&<section className="students-create-panel">
    <div className="panel-head"><div><h2>Créer une séance</h2><p>Choisissez un module et définissez l’horaire et le nombre de places.</p></div><BookOpen size={19}/></div>
    {selectedModules.length?<TheorySessionForm modules={selectedModules}/>:<p className="empty-state">Aucun module actif disponible. Configurez d’abord le programme de l’établissement.</p>}
   </section>}
   <section className="students-list-panel">
    <div className="panel-head"><div><h2>Séances planifiées</h2><p>Les séances futures apparaissent dans les choix des élèves.</p></div><CalendarClock size={18}/></div>
    {upcoming.length===0?<p className="empty-state">Aucune séance théorique à venir.</p>:<div className="theory-course-list">
     {upcoming.map(session=>{
      const module=Array.isArray(session.module)?session.module[0]:session.module;
      const phase=Array.isArray(module?.phase)?module?.phase[0]:module?.phase;
      const registered=counts.get(session.id)??0;
      return <article className="theory-course-row" key={session.id}>
       <div className="theory-course-icon"><BookOpen size={18}/></div>
       <div className="theory-course-main"><strong>{session.title}</strong><span>Phase {phase?.phase_number??"—"} · Module {module?.module_number??"—"} — {module?.name??"Module"}</span><small><CalendarClock size={13}/> {dateTime(session.start_at)} · {time(session.start_at)}–{time(session.end_at)}</small><small><MapPin size={13}/> {session.location??"Lieu à confirmer"}</small></div>
       <div className="theory-course-capacity"><span><Users size={14}/> {registered}/{session.capacity}</span><small>{Math.max(0,session.capacity-registered)} place(s) libre(s)</small></div>
      </article>;
     })}
    </div>}
   </section>
   <footer className="portal-footer"><span>© 2026 ConduiPRO</span><span>Planification des cours théoriques · {school?.name??"Votre école"}</span></footer>
  </section>
 </main>;
}
