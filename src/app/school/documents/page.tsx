import { ArrowLeft,CheckCircle2,FileCheck2,FileText,ShieldCheck,XCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reviewStudentPermit } from "@/app/actions/documents";

export const dynamic="force-dynamic";

type PermitRow={
 id:string;
 student_id:string;
 license_number:string|null;
 expiry_date:string|null;
 document_path:string|null;
 verification_status:string;
 rejection_reason:string|null;
 created_at:string;
 student:{first_name:string;last_name:string;contract_number:string}|null;
 signedUrl:string|null;
};

const notices:Record<string,string>={
 reviewed:"Le dossier du permis a été mis à jour et archivé.",
 invalid:"Vérifiez les informations du formulaire.",
 forbidden:"Votre rôle ne permet pas de vérifier les permis.",
 "reason-required":"Un motif est obligatoire pour refuser un permis.",
 "record-missing":"Le dossier n’existe plus ou n’appartient pas à votre établissement.",
 "already-reviewed":"Ce permis a déjà été traité.",
 "document-missing":"Le fichier ou ses métadonnées ne sont plus disponibles.",
 "review-error":"La vérification n’a pas pu être enregistrée. Réessayez."
};

function date(value:string|null) {
 if(!value) return "—";
 return new Intl.DateTimeFormat("fr-CA",{day:"numeric",month:"long",year:"numeric",timeZone:"America/Toronto"}).format(new Date(value));
}
function label(status:string) {
 if(status==="pending") return "En attente";
 if(status==="approved") return "Approuvé";
 if(status==="rejected") return "À corriger";
 return status;
}

export default async function DocumentsPage({searchParams}:{searchParams:Promise<{notice?:string}>}) {
 const params=await searchParams;
 const supabase=await createSupabaseServerClient();
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user) redirect("/login");

 const {data:profile,error:profileError}=await supabase.from("profiles")
  .select("account_type").eq("id",user.id).maybeSingle();
 if(profileError||profile?.account_type!=="school") redirect("/login?error=school-access");
 const {data:membership,error:membershipError}=await supabase.from("school_members")
  .select("school_id,role").eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
 if(membershipError||!membership) redirect("/login?error=school-access");
 const canReview=["owner","admin","employee"].includes(membership.role);

 const [{data:school},{data:rows,error:licensesError}]=await Promise.all([
  supabase.from("schools").select("name").eq("id",membership.school_id).maybeSingle(),
  supabase.from("student_licenses")
   .select("id,student_id,license_number,expiry_date,document_path,verification_status,rejection_reason,created_at,student:students!student_licenses_student_school_fk(first_name,last_name,contract_number)")
   .eq("school_id",membership.school_id)
   .order("created_at",{ascending:false})
   .limit(100)
 ]);

 const permits:PermitRow[]=await Promise.all(((rows??[]) as unknown as Omit<PermitRow,"signedUrl">[]).map(async row=>{
  let signedUrl:string|null=null;
  if(row.document_path) {
   const {data}=await supabase.storage.from("student-documents").createSignedUrl(row.document_path,300);
   signedUrl=data?.signedUrl??null;
  }
  return {...row,signedUrl};
 }));
 const pending=permits.filter(p=>p.verification_status==="pending");
 const history=permits.filter(p=>p.verification_status!=="pending");
 const notice=params.notice?notices[params.notice]:null;

 return <main className="documents-shell">
  <header className="students-admin-header">
   <a className="students-brand" href="/school"><span className="brand-mark"><FileCheck2 size={20}/></span><span><strong>ConduiPRO</strong><small>PORTAIL ÉCOLE</small></span></a>
   <div className="students-head-right"><span>{school?.name??"Votre école"}</span><a href="/school"><ArrowLeft size={15}/> Tableau de bord</a></div>
  </header>
  <section className="documents-content">
   <div className="students-page-heading">
    <div><p className="hero-kicker">DOSSIERS ÉLÈVES</p><h1>Vérification des permis</h1><p>Ouvrez les documents privés, validez leur conformité ou retournez-les avec un motif.</p></div>
    <div className="students-total"><FileText size={18}/><strong>{pending.length}</strong><small>à vérifier</small></div>
   </div>
   {notice&&<div className="student-notice" role="status">{notice}</div>}
   {licensesError&&<div className="student-notice" role="alert">Impossible de charger les dossiers de permis.</div>}

   <section className="students-list-panel">
    <div className="panel-head"><div><h2>En attente de vérification</h2><p>Permis transmis par les élèves après la réussite du module 5 en phase 1.</p></div><ShieldCheck size={19}/></div>
    {pending.length===0?<p className="empty-state">Aucun permis n’attend actuellement votre vérification.</p>:
     <div className="permit-review-list">{pending.map(permit=>{
      const student=permit.student;
      return <article key={permit.id}>
       <div className="permit-review-heading">
        <span className="request-avatar">{student?.first_name?.[0]??"É"}{student?.last_name?.[0]??""}</span>
        <span><strong>{student?student.first_name+" "+student.last_name:"Élève"}</strong><small>Contrat {student?.contract_number??"—"} · Transmis le {date(permit.created_at)}</small></span>
        <span className="request-status">En attente</span>
       </div>
       <div className="permit-review-meta">
        <span>Numéro de permis : <b>{permit.license_number||"Non indiqué"}</b></span>
        <span>Expiration : <b>{date(permit.expiry_date)}</b></span>
       </div>
       {permit.signedUrl?<a className="permit-open-link" href={permit.signedUrl} target="_blank" rel="noreferrer"><FileText size={15}/> Ouvrir le document privé <span>· lien temporaire 5 min</span></a>:<p className="permit-open-error">Fichier indisponible ou accès Storage refusé.</p>}
       {canReview?
        <form action={reviewStudentPermit} className="permit-review-form">
         <input type="hidden" name="license_id" value={permit.id}/>
         <label>Motif (obligatoire en cas de refus)<textarea name="rejection_reason" rows={2} maxLength={500} placeholder="Ex. : photo illisible, permis expiré ou document incomplet." /></label>
         <div><button type="submit" name="status" value="approved"><CheckCircle2 size={15}/> Approuver</button><button type="submit" name="status" value="rejected"><XCircle size={15}/> Refuser et demander un nouveau dépôt</button></div>
        </form>:<p className="student-helper">Votre rôle permet la consultation, mais pas la validation des permis.</p>}
      </article>;
     })}</div>}
   </section>

   <section className="students-list-panel">
    <div className="panel-head"><div><h2>Historique des vérifications</h2><p>Les décisions précédentes restent conservées dans le dossier élève.</p></div><FileCheck2 size={19}/></div>
    {history.length===0?<p className="empty-state">Aucun permis vérifié pour le moment.</p>:
     <div className="permit-history-list">{history.map(permit=>{
      const student=permit.student;
      return <article key={permit.id}>
       <div><strong>{student?student.first_name+" "+student.last_name:"Élève"} · {student?.contract_number??"—"}</strong><small>{date(permit.created_at)} · {label(permit.verification_status)}</small>{permit.rejection_reason&&<small>Motif : {permit.rejection_reason}</small>}</div>
       <span className={"request-status status-"+permit.verification_status}>{label(permit.verification_status)}</span>
       {permit.signedUrl&&<a href={permit.signedUrl} target="_blank" rel="noreferrer">Ouvrir le fichier</a>}
      </article>;
     })}</div>}
   </section>
   <footer className="portal-footer"><span>© 2026 ConduiPRO</span><span>Documents confidentiels · {school?.name??"Votre école"}</span></footer>
  </section>
 </main>;
}
