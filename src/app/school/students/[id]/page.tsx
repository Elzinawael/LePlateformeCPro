import { ArrowLeft,BookOpen,CarFront,CheckCircle2,FileCheck2,GraduationCap,UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { advanceStudentPhase,updateStudentModuleProgress } from "@/app/actions/progress";

export const dynamic="force-dynamic";

type Phase={id:string;phase_number:number;name:string;school_id:string|null};
type Module={id:string;phase_id:string;module_number:number;name:string;duration_minutes:number;sort_order:number;is_active:boolean};
type Lesson={id:string;phase_id:string;lesson_number:number;name:string;duration_minutes:number;sort_order:number;is_active:boolean};
type ModuleProgress={id:string;module_id:string;status:string;completed_at:string|null;notes:string|null};
type PracticalProgress={id:string;lesson_id:string;status:string;scheduled_at:string|null;completed_at:string|null;notes:string|null};

const notices:Record<string,string>={
 "progress-updated":"La progression théorique a été enregistrée.",
 "progress-invalid":"Vérifiez les informations de la mise à jour.",
 "progress-error":"La mise à jour de la progression a échoué.",
 "module-five-prerequisite":"Les modules 1 à 4 doivent être réussis avant de valider l’évaluation du module 5.",
 "phase-duration":"La durée minimale de la phase actuelle n’est pas encore atteinte.",
 "phase-incomplete":"Tous les modules et toutes les sorties pratiques de la phase actuelle doivent être complétés.",
 "phase-error":"Le passage à la phase suivante n’a pas pu être effectué.",
 "phase-final":"L’élève est déjà dans la phase finale.",
 "phase-advanced":"L’élève a été transféré à la phase suivante."
};
function statusLabel(value:string){
 if(value==="completed") return "Complété";
 if(value==="in_progress") return "En cours";
 if(value==="scheduled") return "Planifié";
 return "À commencer";
}
function formatDate(value:string|null){
 if(!value) return "—";
 const normalized=/^\\d{4}-\\d{2}-\\d{2}$/.test(value)?value+"T12:00:00Z":value;
 return new Intl.DateTimeFormat("fr-CA",{day:"numeric",month:"long",year:"numeric",timeZone:"America/Toronto"}).format(new Date(normalized));
}

export default async function StudentRecordPage({
 params,searchParams
}:{params:Promise<{id:string}>;searchParams:Promise<{notice?:string}>}) {
 const [{id:studentId},{notice:noticeKey}]=await Promise.all([params,searchParams]);
 const supabase=await createSupabaseServerClient();
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user) redirect("/login");

 const {data:profile,error:profileError}=await supabase.from("profiles")
  .select("account_type,first_name,last_name").eq("id",user.id).maybeSingle();
 if(profileError||profile?.account_type!=="school") redirect("/login?error=school-access");
 const {data:membership,error:membershipError}=await supabase.from("school_members")
  .select("school_id,role").eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
 if(membershipError||!membership) redirect("/login?error=school-access");
 if(!["owner","admin","employee"].includes(membership.role)) redirect("/school/instructor");

 const [{data:school},{data:student,error:studentError},{data:schoolPhases},{data:globalPhases}]=await Promise.all([
  supabase.from("schools").select("name").eq("id",membership.school_id).maybeSingle(),
  supabase.from("students").select("id,first_name,last_name,contract_number,email,phone,date_of_birth,enrollment_date,status,current_phase_id,current_phase_started_at,user_id").eq("id",studentId).eq("school_id",membership.school_id).maybeSingle(),
  supabase.from("curriculum_phases").select("id,phase_number,name,school_id").eq("school_id",membership.school_id).order("phase_number"),
  supabase.from("curriculum_phases").select("id,phase_number,name,school_id").is("school_id",null).order("phase_number")
 ]);
 if(studentError||!student) redirect("/school/students?notice=student-not-found");

 const custom=(schoolPhases??[]) as Phase[];
 const global=(globalPhases??[]) as Phase[];
 const phases=[1,2,3,4].flatMap(number=>{
  const phase=custom.find(p=>p.phase_number===number)??global.find(p=>p.phase_number===number);
  return phase?[phase]:[];
 });
 const phaseIds=phases.map(p=>p.id);
 const [{data:moduleData},{data:lessonData},{data:moduleProgressData},{data:practicalProgressData}]=phaseIds.length?await Promise.all([
  supabase.from("curriculum_modules").select("id,phase_id,module_number,name,duration_minutes,sort_order,is_active").in("phase_id",phaseIds).eq("is_active",true).order("sort_order"),
  supabase.from("practical_lessons").select("id,phase_id,lesson_number,name,duration_minutes,sort_order,is_active").in("phase_id",phaseIds).eq("is_active",true).order("sort_order"),
  supabase.from("student_module_progress").select("id,module_id,status,completed_at,notes").eq("student_id",studentId).eq("school_id",membership.school_id),
  supabase.from("student_practical_progress").select("id,lesson_id,status,scheduled_at,completed_at,notes").eq("student_id",studentId).eq("school_id",membership.school_id)
 ]):[{data:[]},{data:[]},{data:[]},{data:[]}];

 const modules=(moduleData??[]) as Module[];
 const lessons=(lessonData??[]) as Lesson[];
 const moduleProgress=(moduleProgressData??[]) as ModuleProgress[];
 const practicalProgress=(practicalProgressData??[]) as PracticalProgress[];
 const currentPhase=phases.find(p=>p.id===student.current_phase_id)??null;
 const completedModules=new Set(moduleProgress.filter(p=>p.status==="completed").map(p=>p.module_id));
 const completedLessons=new Set(practicalProgress.filter(p=>p.status==="completed").map(p=>p.lesson_id));
 const completedTheory=completedModules.size;
 const completedPractical=completedLessons.size;
 const phaseOne=phases.find(p=>p.phase_number===1);
 const moduleFive=phaseOne?modules.find(m=>m.phase_id===phaseOne.id&&m.module_number===5):null;
 const permitReady=!!moduleFive&&completedModules.has(moduleFive.id);
 const nextPhase=currentPhase?phases.find(p=>p.phase_number===currentPhase.phase_number+1)??null:null;
 const currentModules=modules.filter(m=>m.phase_id===currentPhase?.id);
 const currentLessons=lessons.filter(l=>l.phase_id===currentPhase?.id);
 const remainingModules=currentModules.filter(m=>!completedModules.has(m.id)).length;
 const remainingLessons=currentLessons.filter(l=>!completedLessons.has(l.id)).length;
 const minimumDays=currentPhase?([28,28,56,56][currentPhase.phase_number-1]??0):0;
 const phaseStarted=student.current_phase_started_at?new Date(student.current_phase_started_at).getTime():Date.now();
 const daysRemaining=Math.max(0,Math.ceil((phaseStarted+minimumDays*86400000-Date.now())/86400000));
 const phaseCanAdvance=!!currentPhase&&!!nextPhase&&remainingModules===0&&remainingLessons===0&&daysRemaining===0;
 const notice=noticeKey?notices[noticeKey]:null;

 return <main className="student-record-shell">
  <header className="students-admin-header">
   <a className="students-brand" href="/school"><span className="brand-mark"><CarFront size={20}/></span><span><strong>ConduiPRO</strong><small>PORTAIL ÉCOLE</small></span></a>
   <div className="students-head-right"><span>{school?.name??"Votre école"}</span><Link href="/school/students"><ArrowLeft size={15}/> Liste des élèves</Link></div>
  </header>
  <section className="student-record-content">
   <div className="student-record-header">
    <div className="record-identity"><span className="record-avatar"><UserRound size={22}/></span><div><p className="hero-kicker">DOSSIER ÉLÈVE · {student.contract_number}</p><h1>{student.first_name} {student.last_name}</h1><p>{student.email??"Courriel non renseigné"} · {student.phone??"Téléphone non renseigné"}</p></div></div>
    <span className={student.status==="active"?"account-active":"account-pending"}>{student.status==="active"?"Actif":student.status}</span>
   </div>
   {notice&&<div className="student-notice" role="status">{notice}</div>}
   <section className="student-record-stats">
    <article><BookOpen size={18}/><strong>{completedTheory}/{modules.length}</strong><small>Modules théoriques terminés</small></article>
    <article><CarFront size={18}/><strong>{completedPractical}/{lessons.length}</strong><small>Sorties pratiques terminées</small></article>
    <article><GraduationCap size={18}/><strong>{currentPhase?"Phase "+currentPhase.phase_number:"À définir"}</strong><small>{currentPhase?.name??"Phase actuelle"}</small></article>
    <article><FileCheck2 size={18}/><strong>{permitReady?"Prêt au dépôt":"À compléter"}</strong><small>Jalon du permis apprenti</small></article>
   </section>
   <section className="students-list-panel">
    <div className="panel-head"><div><h2>Informations du dossier</h2><p>Informations administratives de l’élève</p></div><UserRound size={18}/></div>
    <div className="student-record-details">
     <div><small>Numéro de contrat</small><strong>{student.contract_number}</strong></div>
     <div><small>Date d’inscription</small><strong>{formatDate(student.enrollment_date)}</strong></div>
     <div><small>Date de naissance</small><strong>{formatDate(student.date_of_birth)}</strong></div>
     <div><small>Compte élève</small><strong>{student.user_id?"Compte associé":"Invitation à envoyer"}</strong></div>
    </div>
   </section>

   <section className="students-list-panel phase-transition-panel">
    <div className="panel-head"><div><h2>Passage à la phase suivante</h2><p>Le passage respecte les durées minimales et les validations du programme SAAQ.</p></div><GraduationCap size={18}/></div>
    {currentPhase&&nextPhase?<div className="phase-transition-content">
      <div><strong>Phase {currentPhase.phase_number} → Phase {nextPhase.phase_number}</strong><small>Début de la phase : {formatDate(student.current_phase_started_at)} · Durée minimale : {minimumDays} jours</small></div>
      <div className="phase-transition-checks"><span>{remainingModules} module(s) restant(s)</span><span>{remainingLessons} sortie(s) pratique(s) restante(s)</span><span>{daysRemaining} jour(s) avant la fin du délai minimal</span></div>
      {phaseCanAdvance?<form action={advanceStudentPhase}><input type="hidden" name="student_id" value={student.id}/><button type="submit">Valider le passage à la phase {nextPhase.phase_number}</button></form>:<p className="student-helper">Le passage sera disponible lorsque toutes les validations seront terminées et que la durée minimale sera écoulée.</p>}
    </div>:<p className="empty-state">{currentPhase?"L’élève a atteint la phase finale du programme.":"La phase actuelle doit être définie par l’école."}</p>}
   </section>

   <section className="students-list-panel">
    <div className="panel-head"><div><h2>Suivi des modules théoriques</h2><p>Le personnel autorisé confirme les modules suivis et les évaluations.</p></div><BookOpen size={18}/></div>
    {phases.map(phase=>{
     const phaseModules=modules.filter(m=>m.phase_id===phase.id);
     return <div className="record-phase" key={phase.id}>
      <div className="record-phase-heading"><strong>Phase {phase.phase_number} · {phase.name}</strong><small>{phaseModules.filter(m=>completedModules.has(m.id)).length}/{phaseModules.length} complété(s)</small></div>
      {phaseModules.map(module=>{
       const progress=moduleProgress.find(p=>p.module_id===module.id);
       return <article className="record-module-row" key={module.id}>
        <div className="record-module-info"><span className={progress?.status==="completed"?"check-done":"check-pending"}>{progress?.status==="completed"?<CheckCircle2 size={16}/>:module.module_number}</span><span><strong>Module {module.module_number} · {module.name}</strong><small>{module.duration_minutes/60} h · {statusLabel(progress?.status??"not_started")}{progress?.completed_at?" · Validé le "+formatDate(progress.completed_at):""}</small></span></div>
        {progress?<form action={updateStudentModuleProgress} className="record-progress-form">
         <input type="hidden" name="progress_id" value={progress.id}/>
         <select name="status" defaultValue={progress.status} aria-label={"Statut du module "+module.module_number}>
          <option value="not_started">À commencer</option><option value="scheduled">Planifié</option><option value="in_progress">En cours</option><option value="completed">Complété</option>
         </select>
         <input name="notes" defaultValue={progress.notes??""} maxLength={1000} placeholder="Note (facultatif)" aria-label={"Note du module "+module.module_number}/>
         <button type="submit">Enregistrer</button>
        </form>:<span className="account-pending">Progression non initialisée</span>}
       </article>;
      })}
     </div>;
    })}
   </section>

   <section className="students-list-panel">
    <div className="panel-head"><div><h2>Suivi des sorties pratiques</h2><p>L’instructeur affecté confirme les sorties ; l’école conserve la visibilité globale.</p></div><CarFront size={18}/></div>
    {phases.map(phase=>{
     const phaseLessons=lessons.filter(l=>l.phase_id===phase.id);
     return <div className="record-phase" key={phase.id}>
      <div className="record-phase-heading"><strong>Phase {phase.phase_number} · {phase.name}</strong><small>{phaseLessons.filter(l=>completedLessons.has(l.id)).length}/{phaseLessons.length} terminée(s)</small></div>
      {phaseLessons.map(lesson=>{
       const progress=practicalProgress.find(p=>p.lesson_id===lesson.id);
       return <div className="record-practical-row" key={lesson.id}>
        <span className={progress?.status==="completed"?"check-done":"check-pending"}>{progress?.status==="completed"?<CheckCircle2 size={16}/>:lesson.lesson_number}</span>
        <span><strong>Sortie {lesson.lesson_number} · {lesson.name}</strong><small>{lesson.duration_minutes} min · {statusLabel(progress?.status??"not_started")}</small></span>
        <small>{progress?.scheduled_at?formatDate(progress.scheduled_at):"Non planifiée"}</small>
       </div>;
      })}
     </div>;
    })}
   </section>
   <footer className="portal-footer"><span>© 2026 ConduiPRO</span><span>Dossier pédagogique · {school?.name??"Votre école"}</span></footer>
  </section>
 </main>;
}
