import { ArrowLeft,CalendarClock,CarFront,Clock3,UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { schedulePracticalLesson } from "@/app/actions/practical";

export const dynamic="force-dynamic";

type ProgressRow={
 id:string;student_id:string;lesson_id:string;status:string;scheduled_at:string|null;instructor_name:string|null;notes:string|null;
 student:{first_name:string;last_name:string;contract_number:string;current_phase_id:string|null}|null;
 lesson:{name:string;lesson_number:number;phase_id:string}|null;
};
const notices:Record<string,string>={
 scheduled:"La leçon pratique a été planifiée.",
 invalid:"Vérifiez la date, le formateur et les informations saisies.",
 "datetime-invalid":"Choisissez une date et une heure futures.",
 "phase-invalid":"Cette sortie ne fait pas partie de la phase actuelle de l&apos;élève.",
 conflict:"Le formateur ou l&apos;élève possède déjà une leçon dans ce créneau de 55 minutes.",
 "trainer-required":"Indiquez le nom du formateur responsable.",
 "schedule-error":"La planification n'a pas pu être enregistrée."
};
function formatDate(value:string|null) {
 if(!value)return "Non planifiée";
 return new Intl.DateTimeFormat("fr-CA",{weekday:"long",day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"America/Toronto"}).format(new Date(value));
}

export default async function PracticalSessionsPage({searchParams}:{searchParams:Promise<{notice?:string}>}) {
 const params=await searchParams;
 const supabase=await createSupabaseServerClient();
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)redirect("/login");
 const {data:profile,error:profileError}=await supabase.from("profiles").select("account_type").eq("id",user.id).maybeSingle();
 if(profileError||profile?.account_type!=="school")redirect("/login?error=school-access");
 const {data:membership,error:membershipError}=await supabase.from("school_members")
  .select("school_id,role").eq("user_id",user.id).eq("status","active").eq("role","owner").maybeSingle();
 if(membershipError||!membership)redirect("/login?error=school-access");

 const [{data:school},{data:rows,error:progressError}]=await Promise.all([
  supabase.from("schools").select("name").eq("id",membership.school_id).maybeSingle(),
  supabase.from("student_practical_progress")
   .select("id,student_id,lesson_id,status,scheduled_at,instructor_name,notes,student:students!student_practical_progress_student_school_fk(first_name,last_name,contract_number,current_phase_id),lesson:practical_lessons(name,lesson_number,phase_id)")
   .eq("school_id",membership.school_id).order("scheduled_at",{ascending:true,nullsFirst:false}).limit(500)
 ]);
 const progress=(rows??[]) as unknown as ProgressRow[];
 const relevant=progress.filter(row=>row.student&&row.lesson&&row.lesson.phase_id===row.student.current_phase_id&&row.status!=="completed");
 const completed=progress.filter(row=>row.status==="completed").length;
 const scheduled=progress.filter(row=>row.status==="scheduled").length;
 const notice=params.notice?notices[params.notice]:null;

 return <main className="practical-shell">
  <header className="students-admin-header">
   <a className="students-brand" href="/school"><span className="brand-mark"><CarFront size={20}/></span><span><strong>ConduiPRO</strong><small>PORTAIL ÉCOLE</small></span></a>
   <div className="students-head-right"><span>{school?.name??"Votre école"}</span><a href="/school"><ArrowLeft size={15}/> Tableau de bord</a></div>
  </header>
  <section className="practical-content">
   <div className="students-page-heading"><div><p className="hero-kicker">FORMATION PRATIQUE</p><h1>Leçons pratiques</h1><p>Planifiez les sorties de la phase actuelle et consignez le nom du formateur de l&apos;école.</p></div><div className="students-total"><CarFront size={18}/><strong>{scheduled}</strong><small>planifiées</small></div></div>
   {notice&&<div className="student-notice" role="status">{notice}</div>}
   {progressError&&<div className="student-notice" role="alert">Impossible de charger les sorties pratiques.</div>}
   <div className="instructor-metrics">
    <article><span><Clock3 size={18}/></span><strong>{relevant.length}</strong><small>À planifier / replanifier</small></article>
    <article><span><CalendarClock size={18}/></span><strong>{scheduled}</strong><small>Sorties planifiées (école)</small></article>
    <article><span><CarFront size={18}/></span><strong>{completed}</strong><small>Sorties terminées</small></article>
   </div>
   <section className="students-list-panel">
    <div className="panel-head"><div><h2>Sorties de la phase actuelle</h2><p>Une sortie ne peut être planifiée que lorsque l&apos;élève est dans la phase correspondante.</p></div><CalendarClock size={18}/></div>
    {relevant.length===0?<p className="empty-state">Aucune sortie pratique à planifier pour les phases actuelles des élèves.</p>:
     <div className="practical-schedule-list">{relevant.map(row=>{
      const student=row.student!;
      const lesson=row.lesson!;
      return <article key={row.id}>
       <div className="practical-row-heading">
        <div className="request-avatar">{student.first_name[0]}{student.last_name[0]}</div>
        <div><strong>{student.first_name} {student.last_name}</strong><small>Contrat {student.contract_number} · Sortie {lesson.lesson_number} — {lesson.name}</small></div>
        <span className={"request-status status-"+row.status}>{row.status==="scheduled"?"Planifiée":row.status==="in_progress"?"En cours":"À planifier"}</span>
       </div>
       {row.status==="scheduled"&&<p className="student-helper">Créneau actuel : {formatDate(row.scheduled_at)} · Formateur : {row.instructor_name??"Non précisé"}</p>}
       <form action={schedulePracticalLesson} className="practical-schedule-form">
        <input type="hidden" name="progress_id" value={row.id}/>
        <label>Date et heure<input name="scheduled_at" type="datetime-local" required defaultValue={row.scheduled_at?new Date(new Date(row.scheduled_at).getTime()-new Date(row.scheduled_at).getTimezoneOffset()*60000).toISOString().slice(0,16):""}/></label>
        <label>Nom du formateur<input name="instructor_name" required maxLength={120} defaultValue={row.instructor_name??""} placeholder="Nom du moniteur responsable"/></label>
        <label>Observation (facultatif)<textarea name="notes" rows={2} maxLength={1000} defaultValue={row.notes??""} placeholder="Consignes ou remarque interne"/></label>
        <input type="hidden" name="timezone_offset" value={new Date().getTimezoneOffset()}/>
        <button className="primary-button" type="submit"><CalendarClock size={15}/>{row.status==="scheduled"?"Enregistrer le nouveau créneau":"Planifier la sortie"}</button>
       </form>
      </article>;
     })}</div>}
   </section>
   <section className="students-list-panel">
    <div className="panel-head"><div><h2>Historique des sorties</h2><p>Sorties déjà réalisées et validées par l&apos;école.</p></div><UserRound size={18}/></div>
    {progress.filter(row=>row.status==="completed").length===0?<p className="empty-state">Aucune sortie terminée pour le moment.</p>:
     <div className="module-list">{progress.filter(row=>row.status==="completed").map(row=><div className="module-row" key={row.id}><span className="check-complete"><CarFront size={13}/></span><span>{row.student?.first_name} {row.student?.last_name} · Sortie {row.lesson?.lesson_number} — {row.lesson?.name}</span><small>{formatDate(row.scheduled_at)}</small></div>)}</div>}
   </section>
   <footer className="portal-footer"><span>© 2026 ConduiPRO</span><span>Planification des sorties pratiques</span></footer>
  </section>
 </main>;
}
