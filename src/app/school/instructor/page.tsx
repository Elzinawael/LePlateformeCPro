import { ArrowLeft,BookOpen,CarFront,CheckCircle2,Clock3,GraduationCap,Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateAssignedPracticalProgress } from "@/app/actions/instructor";
import { signOut } from "@/app/actions/auth";

export const dynamic="force-dynamic";

type ProgressRow={
 id:string;
 student_id:string;
 lesson_id:string;
 status:string;
 scheduled_at:string|null;
 completed_at:string|null;
 notes:string|null;
 student:{id:string;first_name:string;last_name:string;contract_number:string}|null;
 lesson:{name:string;lesson_number:number;duration_minutes:number}|null;
};
type AssignmentRow={student_id:string;student:{id:string;first_name:string;last_name:string;contract_number:string}|null};
const notices:Record<string,string>={
 updated:"La progression de la leçon a été enregistrée.",
 invalid:"Vérifiez les informations saisies.",
 "update-error":"La mise à jour n’a pas été autorisée ou la leçon ne vous est pas affectée."
};
function label(status:string){
 if(status==="in_progress") return "En cours";
 if(status==="completed") return "Terminée";
 if(status==="scheduled") return "Planifiée";
 return "À commencer";
}
function dateTime(value:string){
 return new Intl.DateTimeFormat("fr-CA",{weekday:"long",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit",timeZone:"America/Toronto"}).format(new Date(value));
}

export default async function InstructorPortal({searchParams}:{searchParams:Promise<{notice?:string}>}) {
 const params=await searchParams;
 const supabase=await createSupabaseServerClient();
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user) redirect("/login");
 const {data:profile,error:profileError}=await supabase.from("profiles").select("account_type,first_name,last_name").eq("id",user.id).maybeSingle();
 if(profileError||profile?.account_type!=="school") redirect("/login?error=school-access");
 const {data:membership,error:membershipError}=await supabase.from("school_members").select("school_id,role").eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
 if(membershipError||!membership||membership.role!=="instructor") redirect("/school");

 const [{data:school},{data:assignments},{data:rawProgress}] = await Promise.all([
  supabase.from("schools").select("name").eq("id",membership.school_id).maybeSingle(),
  supabase.from("instructor_student_assignments").select("student_id,student:students(id,first_name,last_name,contract_number)").eq("school_id",membership.school_id).eq("instructor_user_id",user.id).eq("active",true),
  supabase.from("student_practical_progress").select("id,student_id,lesson_id,status,scheduled_at,completed_at,notes,student:students(id,first_name,last_name,contract_number),lesson:practical_lessons(name,lesson_number,duration_minutes)").eq("school_id",membership.school_id).order("scheduled_at",{ascending:true,nullsFirst:false}).limit(100)
 ]);
 const assignedRows=(assignments??[]) as unknown as AssignmentRow[];
 const assignedIds=new Set(assignedRows.map(a=>a.student_id));
 const progress=(rawProgress??[]) as unknown as ProgressRow[];
 const myProgress=progress.filter(item=>assignedIds.has(item.student_id));
 const assignedStudents=assignedRows.map(a=>a.student).filter((s):s is NonNullable<AssignmentRow["student"]>=>!!s);
 const completed=myProgress.filter(p=>p.status==="completed").length;
 const inProgress=myProgress.filter(p=>p.status==="in_progress").length;
 const notice=params.notice?notices[params.notice]:null;
 const instructorName=[profile.first_name,profile.last_name].filter(Boolean).join(" ")||"Instructeur";
 const upcoming=myProgress.filter(p=>p.scheduled_at&&p.status!=="completed").slice(0,8);
 const needsAction=myProgress.filter(p=>p.status==="not_started"||p.status==="scheduled"||p.status==="in_progress").slice(0,30);

 return <main className="instructor-shell">
  <header className="students-admin-header">
   <a className="students-brand" href="/school/instructor"><span className="brand-mark"><CarFront size={20}/></span><span><strong>ConduiPRO</strong><small>ESPACE INSTRUCTEUR</small></span></a>
   <div className="students-head-right"><span>{school?.name??"Votre école"}</span><form action={signOut}><button className="student-logout" type="submit"><ArrowLeft size={15}/> Quitter</button></form></div>
  </header>
  <section className="instructor-content">
   <div className="students-page-heading"><div><p className="hero-kicker">ESPACE INSTRUCTEUR · {school?.name?.toLocaleUpperCase("fr-CA")??""}</p><h1>Bonjour, {instructorName}</h1><p>Consultez uniquement les élèves qui vous sont affectés et mettez à jour leurs leçons pratiques.</p></div><div className="students-total"><GraduationCap size={18}/><strong>{assignedStudents.length}</strong><small>élèves affectés</small></div></div>
   {notice&&<div className="student-notice" role="status">{notice}</div>}
   <div className="instructor-metrics">
    <article><span><Users size={18}/></span><strong>{assignedStudents.length}</strong><small>Élèves affectés</small></article>
    <article><span><Clock3 size={18}/></span><strong>{inProgress}</strong><small>Leçons en cours</small></article>
    <article><span><CheckCircle2 size={18}/></span><strong>{completed}</strong><small>Leçons terminées</small></article>
   </div>
   <section className="students-list-panel">
    <div className="panel-head"><div><h2>Mes élèves</h2><p>Accès restreint aux affectations actives</p></div><Users size={18}/></div>
    {assignedStudents.length===0?<p className="empty-state">Aucun élève ne vous a encore été affecté par l’administration.</p>:
     <div className="instructor-student-list">{assignedStudents.map(student=><div key={student.id}><span className="request-avatar">{student.first_name[0]}{student.last_name[0]}</span><span><strong>{student.first_name} {student.last_name}</strong><small>Contrat {student.contract_number}</small></span><span className="account-active">Affecté</span></div>)}</div>}
   </section>
   <section className="students-list-panel">
    <div className="panel-head"><div><h2>Progression des leçons pratiques</h2><p>Vous pouvez démarrer une leçon et confirmer sa réalisation.</p></div><CarFront size={18}/></div>
    {needsAction.length===0?<p className="empty-state">Aucune leçon pratique à mettre à jour.</p>:
     <div className="instructor-progress-list">{needsAction.map(item=>{
      const student=item.student;
      const lesson=item.lesson;
      return <article key={item.id}>
       <div className="instructor-progress-top"><div><strong>{student?student.first_name+" "+student.last_name:"Élève"}</strong><small>Contrat {student?.contract_number??"—"} · Sortie {lesson?.lesson_number??"—"} — {lesson?.name??"Leçon pratique"}</small></div><span className={"request-status status-"+item.status}>{label(item.status)}</span></div>
       {item.scheduled_at&&<p className="instructor-scheduled">{dateTime(item.scheduled_at)}</p>}
       <form action={updateAssignedPracticalProgress} className="instructor-update-form">
        <input type="hidden" name="progress_id" value={item.id}/>
        <label>Note de suivi<textarea name="notes" rows={2} maxLength={1000} defaultValue={item.notes??""} placeholder="Commentaire pédagogique (facultatif)"/></label>
        <div><button name="status" value="in_progress" type="submit" disabled={item.status==="in_progress"}>Démarrer</button><button name="status" value="completed" type="submit">Confirmer la leçon</button></div>
       </form>
      </article>;
     })}</div>}
   </section>
   <section className="students-list-panel">
    <div className="panel-head"><div><h2>Prochaines leçons</h2><p>Les rendez-vous pratiques déjà planifiés</p></div><BookOpen size={18}/></div>
    {upcoming.length===0?<p className="empty-state">Aucune leçon planifiée actuellement.</p>:<div className="module-list">{upcoming.map(item=><div className="module-row" key={item.id}><span className="check-pending"><CarFront size={13}/></span><span>{item.student?.first_name} {item.student?.last_name} · {item.lesson?.name}</span><small>{item.scheduled_at?dateTime(item.scheduled_at):""}</small></div>)}</div>}
   </section>
   <footer className="portal-footer"><span>© 2026 ConduiPRO</span><span>Espace instructeur · Données strictement affectées</span></footer>
  </section>
 </main>;
}
