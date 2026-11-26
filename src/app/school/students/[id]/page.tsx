import { ArrowLeft,BookOpen,CarFront,CheckCircle2,FileCheck2,GraduationCap,UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { advanceStudentPhase,updateStudentModuleProgress } from "@/app/actions/progress";
import { recordStudentPayment,saveStudentContract,updateStudentDetails,uploadStudentContract } from "@/app/actions/finance";

export const dynamic="force-dynamic";

type Phase={id:string;phase_number:number;name:string;school_id:string|null};
type Module={id:string;phase_id:string;module_number:number;name:string;duration_minutes:number;sort_order:number;is_active:boolean};
type Lesson={id:string;phase_id:string;lesson_number:number;name:string;duration_minutes:number;sort_order:number;is_active:boolean};
type ModuleProgress={id:string;module_id:string;status:string;completed_at:string|null;notes:string|null};
type PracticalProgress={id:string;lesson_id:string;status:string;scheduled_at:string|null;completed_at:string|null;notes:string|null;instructor_name:string|null};
type ContractRow={id:string;contract_number:string;contract_date:string|null;contract_amount:number;currency:string;status:string;contract_file_path:string|null};
type InvoiceRow={id:string;invoice_number:string;issue_date:string;due_date:string|null;total_amount:number;status:string};
type PaymentRow={id:string;invoice_id:string|null;amount:number;payment_method:string;payment_date:string;reference:string|null;notes:string|null};

const notices:Record<string,string>={
 "progress-updated":"La progression théorique a été enregistrée.",
 "progress-invalid":"Vérifiez les informations de la mise à jour.",
 "progress-error":"La mise à jour de la progression a échoué.",
 "module-five-prerequisite":"Les modules 1 à 4 doivent être réussis avant de valider l’évaluation du module 5.",
 "phase-duration":"La durée minimale de la phase actuelle n’est pas encore atteinte.",
 "phase-incomplete":"Tous les modules et toutes les sorties pratiques de la phase actuelle doivent être complétés.",
 "phase-error":"Le passage à la phase suivante n’a pas pu être effectué.",
 "phase-final":"L’élève est déjà dans la phase finale.",
 "phase-advanced":"L’élève a été transféré à la phase suivante.",
 "details-saved":"Les coordonnées de l’élève ont été mises à jour.",
 "details-invalid":"Vérifiez le prénom, le nom et les coordonnées.",
 "details-error":"Les coordonnées n’ont pas pu être mises à jour.",
 "contract-saved":"Le contrat et sa facture ont été enregistrés.",
 "contract-invalid":"Saisissez un montant de contrat positif et des dates valides.",
 "contract-error":"Le contrat n’a pas pu être enregistré.",
 "contract-paid-conflict":"Le montant du contrat ne peut pas être inférieur aux paiements déjà enregistrés.",
 "contract-required":"Enregistrez d’abord le contrat avant de déposer son PDF.",
 "contract-file-invalid":"Sélectionnez un PDF valide de 10 Mo maximum.",
 "contract-file-type":"Le contrat doit être au format PDF.",
 "contract-upload-error":"Le dépôt du contrat a échoué.",
 "contract-file-saved":"Le contrat PDF est maintenant accessible à l’élève.",
 "payment-saved":"Le paiement a été enregistré et le solde recalculé.",
 "payment-invalid":"Vérifiez le montant, la date et le mode de paiement.",
 "payment-too-large":"Le paiement dépasse le solde restant de la facture.",
 "payment-error":"Le paiement n’a pas pu être enregistré.",
 "invoice-not-found":"La facture sélectionnée est introuvable."
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
  .select("school_id,role").eq("user_id",user.id).eq("status","active").eq("role","owner").maybeSingle();
 if(membershipError||!membership) redirect("/login?error=school-access");
 if(!["owner","admin","employee"].includes(membership.role)) redirect("/school/instructor");

 const [{data:school},{data:student,error:studentError},{data:schoolPhases},{data:globalPhases},{data:contract},{data:invoiceRows},{data:paymentRows}]=await Promise.all([
  supabase.from("schools").select("name").eq("id",membership.school_id).maybeSingle(),
  supabase.from("students").select("id,first_name,last_name,contract_number,email,phone,date_of_birth,enrollment_date,status,current_phase_id,current_phase_started_at,user_id").eq("id",studentId).eq("school_id",membership.school_id).maybeSingle(),
  supabase.from("curriculum_phases").select("id,phase_number,name,school_id").eq("school_id",membership.school_id).order("phase_number"),
  supabase.from("curriculum_phases").select("id,phase_number,name,school_id").is("school_id",null).order("phase_number"),
  supabase.from("student_contracts").select("id,contract_number,contract_date,contract_amount,currency,status,contract_file_path").eq("student_id",studentId).eq("school_id",membership.school_id).eq("status","active").order("created_at",{ascending:false}).limit(1).maybeSingle(),
  supabase.from("invoices").select("id,invoice_number,issue_date,due_date,total_amount,status").eq("student_id",studentId).eq("school_id",membership.school_id).order("issue_date",{ascending:false}),
  supabase.from("payments").select("id,invoice_id,amount,payment_method,payment_date,reference,notes").eq("student_id",studentId).eq("school_id",membership.school_id).order("payment_date",{ascending:false})
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
  supabase.from("student_practical_progress").select("id,lesson_id,status,scheduled_at,completed_at,notes,instructor_name").eq("student_id",studentId).eq("school_id",membership.school_id)
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
 const contracts=(contract?[contract]:[]) as ContractRow[];
 const activeContract=contracts[0]??null;
 const invoices=(invoiceRows??[]) as InvoiceRow[];
 const payments=(paymentRows??[]) as PaymentRow[];
 const paidByInvoice=new Map<string,number>();
 payments.forEach(payment=>{if(payment.invoice_id)paidByInvoice.set(payment.invoice_id,(paidByInvoice.get(payment.invoice_id)??0)+Number(payment.amount));});
 const invoiceBalances=invoices.map(invoice=>({
  ...invoice,
  paid:paidByInvoice.get(invoice.id)??0,
  remaining:Math.max(0,Number(invoice.total_amount)-(paidByInvoice.get(invoice.id)??0))
 }));
 const outstandingBalance=invoiceBalances.filter(invoice=>!["paid","cancelled","draft"].includes(invoice.status)).reduce((sum,invoice)=>sum+invoice.remaining,0);
 let contractSignedUrl:string|null=null;
 if(activeContract?.contract_file_path){
  const {data}=await supabase.storage.from("student-documents").createSignedUrl(activeContract.contract_file_path,300);
  contractSignedUrl=data?.signedUrl??null;
 }
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
    <form action={updateStudentDetails} className="student-edit-form">
     <input type="hidden" name="student_id" value={student.id}/>
     <label>Prénom<input name="first_name" required maxLength={100} defaultValue={student.first_name}/></label>
     <label>Nom<input name="last_name" required maxLength={100} defaultValue={student.last_name}/></label>
     <label>Courriel de contact<input name="email" type="email" maxLength={254} defaultValue={student.email??""}/></label>
     <label>Téléphone<input name="phone" type="tel" maxLength={40} defaultValue={student.phone??""}/></label>
     <label>Date de naissance<input name="date_of_birth" type="date" defaultValue={student.date_of_birth??""}/></label>
     <div className="student-edit-readonly"><small>Numéro de contrat / identifiant de connexion</small><strong>{student.contract_number}</strong><small>Inscription : {formatDate(student.enrollment_date)} · Compte : {student.user_id?"Actif":"Non lié"}</small></div>
     <button type="submit">Enregistrer les coordonnées</button>
    </form>
   </section>


   <section className="students-list-panel finance-panel">
    <div className="panel-head"><div><h2>Contrat et paiements</h2><p>Le contrat génère une facture et le solde est calculé automatiquement.</p></div><FileCheck2 size={18}/></div>
    <form action={saveStudentContract} className="finance-contract-form">
     <input type="hidden" name="student_id" value={student.id}/>
     <label>Montant total du contrat (CAD)<input name="contract_amount" type="number" min="0.01" max="1000000" step="0.01" required defaultValue={activeContract?.contract_amount??""}/></label>
     <label>Date du contrat<input name="contract_date" type="date" defaultValue={activeContract?.contract_date??""}/></label>
     <label>Date d’échéance de la facture<input name="due_date" type="date" defaultValue={invoiceBalances[0]?.due_date??""}/></label>
     <button type="submit">Enregistrer le contrat et la facture</button>
    </form>
    {activeContract?.contract_file_path&&contractSignedUrl&&<p className="contract-download"><a href={contractSignedUrl} target="_blank" rel="noreferrer">Consulter le contrat PDF</a></p>}
    {activeContract&&<form action={uploadStudentContract} className="contract-upload-form">
     <input type="hidden" name="student_id" value={student.id}/>
     <label>Joindre ou remplacer le contrat signé (PDF)<input type="file" name="contract_file" accept="application/pdf" required/></label>
     <button type="submit">Déposer le contrat PDF</button>
    </form>}
    <div className="finance-balance-row"><span>Solde restant total</span><strong>{new Intl.NumberFormat("fr-CA",{style:"currency",currency:"CAD"}).format(outstandingBalance)}</strong></div>
    {invoices.length===0?<p className="empty-state">Aucune facture. Enregistrez le montant du contrat pour générer la première facture.</p>:
     <div className="finance-invoice-list">{invoiceBalances.map(invoice=><article key={invoice.id}>
      <div className="finance-invoice-heading"><strong>{invoice.invoice_number}</strong><span className={"account-"+(invoice.status==="paid"?"active":"pending")}>{invoice.status==="paid"?"Payée":invoice.status==="partially_paid"?"Partiellement payée":invoice.status==="overdue"?"En retard":invoice.status==="cancelled"?"Annulée":"À payer"}</span></div>
      <div className="finance-invoice-values"><span>Facture : {new Intl.NumberFormat("fr-CA",{style:"currency",currency:"CAD"}).format(Number(invoice.total_amount))}</span><span>Payé : {new Intl.NumberFormat("fr-CA",{style:"currency",currency:"CAD"}).format(invoice.paid)}</span><strong>Reste : {new Intl.NumberFormat("fr-CA",{style:"currency",currency:"CAD"}).format(invoice.remaining)}</strong></div>
      {invoice.remaining>0&&["issued","partially_paid","overdue"].includes(invoice.status)&&<form action={recordStudentPayment} className="finance-payment-form">
       <input type="hidden" name="student_id" value={student.id}/><input type="hidden" name="invoice_id" value={invoice.id}/>
       <label>Montant reçu<input name="amount" type="number" min="0.01" max={invoice.remaining} step="0.01" required/></label>
       <label>Mode de paiement<select name="payment_method" defaultValue="debit"><option value="cash">Espèces</option><option value="debit">Débit</option><option value="credit">Crédit</option><option value="transfer">Virement</option><option value="other">Autre</option></select></label>
       <label>Date du paiement<input name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required/></label>
       <label>Référence (facultatif)<input name="reference" maxLength={120}/></label>
       <button type="submit">Enregistrer le paiement</button>
      </form>}
     </article>)}</div>}
    {payments.length>0&&<div className="finance-payment-history"><h3>Historique des paiements</h3>{payments.map(payment=><div key={payment.id}><span>{formatDate(payment.payment_date)} · {payment.payment_method==="cash"?"Espèces":payment.payment_method==="debit"?"Débit":payment.payment_method==="credit"?"Crédit":payment.payment_method==="transfer"?"Virement":"Autre"}</span><strong>{new Intl.NumberFormat("fr-CA",{style:"currency",currency:"CAD"}).format(Number(payment.amount))}</strong></div>)}</div>}
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
    <div className="panel-head"><div><h2>Suivi des modules théoriques</h2><p>L’école confirme les modules suivis et les évaluations.</p></div><BookOpen size={18}/></div>
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
    <div className="panel-head"><div><h2>Suivi des sorties pratiques</h2><p>L’école planifie et valide les sorties pratiques.</p></div><CarFront size={18}/></div>
    {phases.map(phase=>{
     const phaseLessons=lessons.filter(l=>l.phase_id===phase.id);
     return <div className="record-phase" key={phase.id}>
      <div className="record-phase-heading"><strong>Phase {phase.phase_number} · {phase.name}</strong><small>{phaseLessons.filter(l=>completedLessons.has(l.id)).length}/{phaseLessons.length} terminée(s)</small></div>
      {phaseLessons.map(lesson=>{
       const progress=practicalProgress.find(p=>p.lesson_id===lesson.id);
       return <div className="record-practical-row" key={lesson.id}>
        <span className={progress?.status==="completed"?"check-done":"check-pending"}>{progress?.status==="completed"?<CheckCircle2 size={16}/>:lesson.lesson_number}</span>
        <span><strong>Sortie {lesson.lesson_number} · {lesson.name}</strong><small>{lesson.duration_minutes} min · {statusLabel(progress?.status??"not_started")}</small></span>
        <small>{progress?.scheduled_at?formatDate(progress.scheduled_at):"Non planifiée"}{progress?.instructor_name?" · "+progress.instructor_name:""}</small>
       </div>;
      })}
     </div>;
    })}
   </section>
   <footer className="portal-footer"><span>© 2026 ConduiPRO</span><span>Dossier pédagogique · {school?.name??"Votre école"}</span></footer>
  </section>
 </main>;
}
