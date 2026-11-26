import { ArrowUpRight, BookOpen, CalendarDays, CarFront, CheckCircle2, Clock3, FileCheck2, FileText, Wallet } from "lucide-react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { PracticalRequestForm, PermitUploadForm, TheoryRequestButton } from "./StudentForms";

export const dynamic = "force-dynamic";

type Phase = { id:string; phase_number:number; name:string; school_id:string|null; is_active:boolean };
type Module = { id:string; phase_id:string; module_number:number; name:string; duration_minutes:number; sort_order:number; is_active:boolean };
type Lesson = { id:string; phase_id:string; lesson_number:number; name:string; duration_minutes:number; sort_order:number; is_active:boolean };
type Progress = { module_id:string; status:string };
type PracticalProgress = { lesson_id:string; status:string };
type Course = { id:string; title:string; module_id:string; start_at:string; end_at:string; location:string|null };
type Request = { id:string; request_type:string; status:string; created_at:string; school_response:string|null };
type License = { id:string; license_number:string|null; expiry_date:string|null; verification_status:string; rejection_reason:string|null; document_path:string|null; created_at:string };
type Invoice = { id:string; total_amount:number; status:string };
type Payment = { invoice_id:string|null; amount:number };
type Contract = { contract_number:string; contract_date:string|null; contract_amount:number; currency:string; status:string; contract_file_path:string|null };

function date(value:string|null|undefined) {
  return value ? new Intl.DateTimeFormat("fr-CA",{day:"numeric",month:"long",year:"numeric",timeZone:"America/Toronto"}).format(new Date(value)) : "—";
}
function dateTime(value:string) {
  return new Intl.DateTimeFormat("fr-CA",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"America/Toronto"}).format(new Date(value));
}
function money(value:number,currency="CAD") {
  return new Intl.NumberFormat("fr-CA",{style:"currency",currency,maximumFractionDigits:2}).format(value);
}
function label(status:string) {
  const labels:Record<string,string> = {
    submitted:"Envoyée",processing:"En traitement",approved:"Approuvée",rejected:"À corriger",
    pending:"En attente de vérification",completed:"Complété",in_progress:"En cours",scheduled:"Planifié"
  };
  return labels[status] ?? "À commencer";
}
const notices:Record<string,string> = {
  "request-sent":"Votre demande a été envoyée à l’école.",
  "request-error":"La demande n’a pas pu être envoyée. Vérifiez les conditions puis réessayez.",
  "request-invalid":"Les informations de la demande sont incomplètes.",
  "module-unavailable":"Ce module n’est pas disponible dans votre phase actuelle.",
  "module-completed":"Ce module est déjà complété.",
  "session-unavailable":"Cette séance n’est plus disponible.",
  "availability-invalid":"Décrivez vos disponibilités en 500 caractères maximum.",
  "phase-missing":"Votre école doit confirmer votre phase actuelle.",
  "permit-locked":"Le dépôt est accessible après la réussite des modules 1 à 5 de la phase 1.",
  "file-invalid":"Le fichier est vide ou dépasse la limite de 10 Mo.",
  "file-type":"Le format doit être PDF, JPG ou PNG.",
  "permit-details-invalid":"Le numéro de permis est trop long.",
  "upload-error":"Le téléversement a échoué. Réessayez.",
  "permit-record-error":"Le fichier est téléversé, mais son dossier n’a pas pu être créé. Contactez votre école.",
  "permit-uploaded":"Votre permis a été transmis à l’école pour vérification."
};

export default async function StudentPortal({ searchParams }:{searchParams:Promise<{notice?:string}>}) {
  const params=await searchParams;
  const supabase=await createSupabaseServerClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user) redirect("/login");

  const {data:profile,error:profileError}=await supabase.from("profiles").select("account_type,first_name").eq("id",user.id).maybeSingle();
  if(profileError||profile?.account_type!=="student") redirect("/login?error=student-access");

  const {data:student,error:studentError}=await supabase.from("students")
    .select("id,school_id,contract_number,first_name,last_name,current_phase_id")
    .eq("user_id",user.id).maybeSingle();
  if(studentError||!student) redirect("/login?error=student-access");

  const [
    schoolResult,schoolPhasesResult,globalPhasesResult,contractResult,invoiceResult,
    paymentResult,moduleProgressResult,practicalProgressResult,licenseResult,requestResult,courseResult
  ]=await Promise.all([
    supabase.from("schools").select("name").eq("id",student.school_id).maybeSingle(),
    supabase.from("curriculum_phases").select("id,phase_number,name,school_id,is_active").eq("school_id",student.school_id).order("phase_number"),
    supabase.from("curriculum_phases").select("id,phase_number,name,school_id,is_active").is("school_id",null).order("phase_number"),
    supabase.from("student_contracts").select("contract_number,contract_date,contract_amount,currency,status,contract_file_path").eq("student_id",student.id).eq("school_id",student.school_id).order("contract_date",{ascending:false}).limit(1).maybeSingle(),
    supabase.from("invoices").select("id,total_amount,status").eq("student_id",student.id).eq("school_id",student.school_id).in("status",["issued","partially_paid","overdue"]),
    supabase.from("payments").select("invoice_id,amount").eq("student_id",student.id).eq("school_id",student.school_id),
    supabase.from("student_module_progress").select("module_id,status").eq("student_id",student.id).eq("school_id",student.school_id),
    supabase.from("student_practical_progress").select("lesson_id,status").eq("student_id",student.id).eq("school_id",student.school_id),
    supabase.from("student_licenses").select("id,license_number,expiry_date,verification_status,rejection_reason,document_path,created_at").eq("student_id",student.id).eq("school_id",student.school_id).order("created_at",{ascending:false}).limit(1).maybeSingle(),
    supabase.from("course_requests").select("id,request_type,status,created_at,school_response").eq("student_id",student.id).order("created_at",{ascending:false}).limit(6),
    supabase.from("theory_courses").select("id,title,module_id,start_at,end_at,location").eq("school_id",student.school_id).eq("status","scheduled").gte("start_at",new Date().toISOString()).order("start_at").limit(20)
  ]);

  const schoolName=schoolResult.data?.name??"Votre auto-école";
  const schoolPhases=(schoolPhasesResult.data??[]) as Phase[];
  const globalPhases=(globalPhasesResult.data??[]) as Phase[];
  // A school-specific curriculum overrides the global phase template.
  const exactCurrentPhase=[...schoolPhases,...globalPhases].find(p=>p.id===student.current_phase_id)??null;
  const phases=[1,2,3,4].flatMap(n=>{
    const phase=(exactCurrentPhase?.phase_number===n?exactCurrentPhase:null)
      ??schoolPhases.find(p=>p.phase_number===n)
      ??globalPhases.find(p=>p.phase_number===n);
    return phase?[phase]:[];
  });
  const phaseIds=phases.map(p=>p.id);
  const [moduleResult,lessonResult]=phaseIds.length?await Promise.all([
    supabase.from("curriculum_modules").select("id,phase_id,module_number,name,duration_minutes,sort_order,is_active").in("phase_id",phaseIds).order("sort_order"),
    supabase.from("practical_lessons").select("id,phase_id,lesson_number,name,duration_minutes,sort_order,is_active").in("phase_id",phaseIds).order("sort_order")
  ]):[{data:[]},{data:[]}];

  const modules=(moduleResult.data??[]) as Module[];
  const lessons=(lessonResult.data??[]) as Lesson[];
  const moduleProgress=(moduleProgressResult.data??[]) as Progress[];
  const practicalProgress=(practicalProgressResult.data??[]) as PracticalProgress[];
  const courses=(courseResult.data??[]) as Course[];
  const requests=(requestResult.data??[]) as Request[];
  const license=licenseResult.data as License|null;
  const contract=contractResult.data as Contract|null;
  const invoices=(invoiceResult.data??[]) as Invoice[];
  const payments=(paymentResult.data??[]) as Payment[];

  const currentPhase=phases.find(p=>p.id===student.current_phase_id)??null;
  const currentModules=currentPhase?modules.filter(m=>m.phase_id===currentPhase.id&&m.is_active):[];
  const currentLessons=currentPhase?lessons.filter(l=>l.phase_id===currentPhase.id&&l.is_active):[];
  const validModuleIds=new Set(modules.map(m=>m.id));
  const validLessonIds=new Set(lessons.map(l=>l.id));
  const completedModules=new Set(moduleProgress.filter(p=>p.status==="completed"&&validModuleIds.has(p.module_id)).map(p=>p.module_id));
  const completedLessons=new Set(practicalProgress.filter(p=>p.status==="completed"&&validLessonIds.has(p.lesson_id)).map(p=>p.lesson_id));
  const totalItems=modules.filter(m=>m.is_active).length+lessons.filter(l=>l.is_active).length;
  const doneItems=completedModules.size+completedLessons.size;
  const completion=totalItems?Math.round(doneItems/totalItems*100):0;

  const paidByInvoice=new Map<string,number>();
  payments.forEach(p=>{if(p.invoice_id) paidByInvoice.set(p.invoice_id,(paidByInvoice.get(p.invoice_id)??0)+Number(p.amount));});
  const balance=invoices.reduce((sum,i)=>sum+Math.max(0,Number(i.total_amount)-(paidByInvoice.get(i.id)??0)),0);

  const activeModuleIds=new Set(currentModules.map(m=>m.id));
  const upcomingCourses=courses.filter(c=>activeModuleIds.has(c.module_id)&&!completedModules.has(c.module_id)).slice(0,6);
  const phaseOne=phases.find(p=>p.phase_number===1);
  const phaseOneModuleNumbers=new Set(
    modules.filter(m=>m.phase_id===phaseOne?.id&&m.module_number>=1&&m.module_number<=5)
      .filter(m=>completedModules.has(m.id))
      .map(m=>m.module_number)
  );
  const permitUnlocked=[1,2,3,4,5].every(number=>phaseOneModuleNumbers.has(number));
  const studentName=[student.first_name,student.last_name].filter(Boolean).join(" ")||"Élève";

  let contractUrl:string|null=null;
  if(contract?.contract_file_path) {
    const {data}=await supabase.storage.from("student-documents").createSignedUrl(contract.contract_file_path,300);
    contractUrl=data?.signedUrl??null;
  }
  let permitUrl:string|null=null;
  if(license?.document_path) {
    const {data}=await supabase.storage.from("student-documents").createSignedUrl(license.document_path,300);
    permitUrl=data?.signedUrl??null;
  }
  const notice=params.notice?notices[params.notice]:null;

  return <main className="student-shell">
    <header className="portal-header">
      <div className="brand"><div className="brand-mark"><CarFront size={22}/></div><div><strong>ConduiPRO</strong><small>PORTAIL ÉLÈVE</small></div></div>
      <div className="student-profile">
        <span className="user-avatar">{student.first_name?.[0]??"É"}{student.last_name?.[0]??""}</span>
        <span><b>{studentName}</b><small>Contrat {student.contract_number}</small></span>
        <form action={signOut}><button className="student-logout" type="submit">Quitter</button></form>
      </div>
    </header>

    {notice&&<div className="student-notice" role="status">{notice}</div>}

    <section className="student-welcome">
      <p className="hero-kicker">MON ESPACE CONDUIPRO · {schoolName.toLocaleUpperCase("fr-CA")}</p>
      <h1>Bonjour {student.first_name||profile.first_name||"élève"} 👋</h1>
      <p>Suivez votre formation, consultez vos séances et échangez avec votre auto-école.</p>
      <div className="student-progress">
        <div className="progress-ring big"><span>{completion}%</span></div>
        <div><strong>Votre parcours de formation</strong><p>{currentPhase?"Phase "+currentPhase.phase_number+" · "+currentPhase.name:"Phase à confirmer par l’école"}</p><small>{doneItems} élément(s) terminé(s) sur {totalItems} dans votre programme.</small></div>
      </div>
    </section>

    <section className="student-cards">
      <article className="student-stat"><span className="feature-icon"><BookOpen/></span><small>Modules théoriques</small><strong>{completedModules.size} <em>/ {modules.filter(m=>m.is_active).length}</em></strong><div className="mini-progress"><span style={{width:(modules.filter(m=>m.is_active).length?completedModules.size/modules.filter(m=>m.is_active).length*100:0)+"%"}}/></div></article>
      <article className="student-stat"><span className="feature-icon orange"><CarFront/></span><small>Leçons pratiques</small><strong>{completedLessons.size} <em>/ {lessons.filter(l=>l.is_active).length}</em></strong><div className="mini-progress orange-progress"><span style={{width:(lessons.filter(l=>l.is_active).length?completedLessons.size/lessons.filter(l=>l.is_active).length*100:0)+"%"}}/></div></article>
      <article className="student-stat"><span className="feature-icon green"><Wallet/></span><small>Solde à payer</small><strong>{money(balance)}</strong><em>{contract?"Contrat "+label(contract.status):"Aucun contrat enregistré"}</em></article>
    </section>

    <section className="student-layout">
      <article className="student-panel">
        <div className="panel-head"><div><h2>Ma formation théorique</h2><p>Modules de votre phase actuelle</p></div><BookOpen size={18}/></div>
        <div className="module-list">
          {!currentModules.length&&<p className="empty-state">Votre école n’a pas encore configuré les modules de cette phase.</p>}
          {currentModules.map(m=>{
            const state=moduleProgress.find(p=>p.module_id===m.id)?.status??"not_started";
            return <div className="module-row" key={m.id}><span className={state==="completed"?"check-done":"check-pending"}>{state==="completed"?<CheckCircle2 size={17}/>:m.module_number}</span><span>{m.name}</span><small>{label(state)}</small></div>;
          })}
        </div>
      </article>
      <article className="student-panel">
        <div className="panel-head"><div><h2>Mes leçons pratiques</h2><p>Votre progression par leçon</p></div><CarFront size={18}/></div>
        <div className="module-list">
          {!currentLessons.length&&<p className="empty-state">Aucune leçon configurée pour cette phase.</p>}
          {currentLessons.map(l=>{
            const state=practicalProgress.find(p=>p.lesson_id===l.id)?.status??"not_started";
            return <div className="module-row" key={l.id}><span className={state==="completed"?"check-done":"check-pending"}>{state==="completed"?<CheckCircle2 size={17}/>:l.lesson_number}</span><span>{l.name}</span><small>{label(state)}</small></div>;
          })}
        </div>
      </article>
    </section>

    <section className="student-layout student-section-gap">
      <article className="student-panel">
        <div className="panel-head"><div><h2>Séances théoriques disponibles</h2><p>Réservez une séance pour un module non terminé de votre phase</p></div><CalendarDays size={18}/></div>
        <div className="student-session-list">
          {!upcomingCourses.length&&<p className="empty-state">Aucune séance disponible pour vos modules restants.</p>}
          {upcomingCourses.map(c=>{
            const m=currentModules.find(x=>x.id===c.module_id);
            return <div className="student-session" key={c.id}>
              <div className="student-session-icon"><BookOpen size={18}/></div>
              <div className="student-session-info"><strong>{c.title}</strong><span>{m?.name??"Module théorique"}</span><small>{dateTime(c.start_at)} · {c.location||"Lieu à confirmer"}</small></div>
              <TheoryRequestButton moduleId={c.module_id} courseId={c.id} label="Demander"/>
            </div>;
          })}
        </div>
      </article>
      <article className="student-panel">
        <div className="panel-head"><div><h2>Demander une leçon pratique</h2><p>Indiquez les moments où vous êtes disponible</p></div><CarFront size={18}/></div>
        <PracticalRequestForm/>
      </article>
    </section>

    <section className="student-layout student-section-gap">
      <article className="student-panel">
        <div className="panel-head"><div><h2>Permis d’apprenti conducteur</h2><p>Vérification par votre école · Après l’évaluation du module 5 en phase 1</p></div><FileCheck2 size={18}/></div>
        {license&&<div className="permit-status">
          <div className="permit-status-main"><span className="feature-icon green"><FileText/></span><div><strong>{license.license_number||"Document de permis"}</strong><small>{label(license.verification_status)} · Transmis le {date(license.created_at)}</small>{license.expiry_date&&<small>Expiration : {date(license.expiry_date)}</small>}</div></div>
          {permitUrl&&<a className="link-button" href={permitUrl} target="_blank" rel="noreferrer">Ouvrir le fichier <ArrowUpRight size={14}/></a>}
          {license.rejection_reason&&<p className="permit-rejection">À corriger : {license.rejection_reason}</p>}
        </div>}
        {permitUnlocked&&license?.verification_status!=="pending"&&license?.verification_status!=="approved"
          ?<PermitUploadForm/>
          :!permitUnlocked
            ?<p className="student-helper">Cette étape s’activera après la réussite des quatre premiers modules et de l’évaluation du module 5 en phase 1.</p>
            :license?.verification_status==="pending"
              ?<p className="student-helper">Votre document est en attente de vérification par votre école.</p>
              :<p className="student-helper">Votre permis a été vérifié par votre école.</p>}
      </article>

      <article className="student-panel">
        <div className="panel-head"><div><h2>Mon contrat et mes paiements</h2><p>Informations enregistrées par votre école</p></div><Wallet size={18}/></div>
        {contract?<div className="contract-summary"><strong>Contrat {contract.contract_number}</strong><span>{money(Number(contract.contract_amount),contract.currency)} · {label(contract.status)}</span><small>Date du contrat : {date(contract.contract_date)}</small>{contractUrl&&<a className="link-button" href={contractUrl} target="_blank" rel="noreferrer">Consulter le contrat <ArrowUpRight size={14}/></a>}</div>:<p className="empty-state">Aucun contrat n’a encore été ajouté à votre dossier.</p>}
        <div className="balance-summary"><small>Solde calculé à partir des factures et paiements associés</small><strong>{money(balance)}</strong></div>
      </article>
    </section>

    <section className="student-panel student-section-gap">
      <div className="panel-head"><div><h2>Mes demandes</h2><p>Suivi des demandes envoyées à votre école</p></div><Clock3 size={18}/></div>
      <div className="module-list">
        {!requests.length&&<p className="empty-state">Vous n’avez envoyé aucune demande.</p>}
        {requests.map(r=><div className="module-row" key={r.id}>
          <span className="check-pending">{r.request_type==="theory"?<BookOpen size={13}/>:<CarFront size={13}/>}</span>
          <span>{r.request_type==="theory"?"Cours théorique":"Leçon pratique"}</span>
          <small>{label(r.status)} · {date(r.created_at)}</small>
          {r.school_response&&<span className="request-response">{r.school_response}</span>}
        </div>)}
      </div>
    </section>
    <footer className="portal-footer"><span>© 2026 ConduiPRO</span><span>Votre parcours de conduite · {schoolName}</span></footer>
  </main>;
}
