import { ArrowLeft, BookOpen, CarFront, CheckCircle2, Clock3, Filter, MessageSquareText } from "lucide-react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { processCourseRequest } from "@/app/actions/requests";

export const dynamic="force-dynamic";

type RequestRow={
  id:string;
  request_type:"theory"|"practical";
  status:string;
  created_at:string;
  availability_text:string|null;
  student_message:string|null;
  school_response:string|null;
  preferred_course_id:string|null;
  student:{first_name:string;last_name:string;contract_number:string}|null;
  module:{name:string;module_number:number}|null;
  practical_lesson:{name:string;lesson_number:number}|null;
  course:{title:string;start_at:string;location:string|null}|null;
};

const notices:Record<string,string>={
  updated:"La demande a été mise à jour.",
  invalid:"Vérifiez les informations saisies.",
  forbidden:"Votre rôle ne permet pas de traiter les demandes.",
  "request-missing":"Cette demande n’existe plus ou n’appartient pas à votre établissement.",
  "request-closed":"Cette demande est déjà fermée.",
  "response-required":"Ajoutez une réponse avant de refuser ou d’approuver une demande pratique.",
  "course-required":"Cette demande théorique ne contient pas de séance sélectionnée.",
  "session-unavailable":"La séance n’est plus disponible.",
  "session-full":"Cette séance a atteint sa capacité maximale.",
  "enrollment-error":"L’inscription à la séance n’a pas pu être créée.",
  "update-error":"Le statut de la demande n’a pas pu être mis à jour."
};

function statusLabel(status:string) {
  if(status==="submitted") return "À traiter";
  if(status==="processing") return "En traitement";
  if(status==="approved") return "Approuvée";
  if(status==="rejected") return "Refusée";
  return status;
}
function dateTime(value:string) {
  return new Intl.DateTimeFormat("fr-CA",{
    weekday:"long",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit",
    timeZone:"America/Toronto"
  }).format(new Date(value));
}
function studentName(student:RequestRow["student"]) {
  return student?[student.first_name,student.last_name].filter(Boolean).join(" "):"Élève";
}

export default async function RequestsPage({searchParams}:{searchParams:Promise<{notice?:string}>}) {
  const params=await searchParams;
  const supabase=await createSupabaseServerClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user) redirect("/login");

  const {data:profile,error:profileError}=await supabase.from("profiles")
    .select("account_type,first_name,last_name").eq("id",user.id).maybeSingle();
  if(profileError||profile?.account_type!=="school") redirect("/login?error=school-access");

  const {data:membership,error:membershipError}=await supabase.from("school_members")
    .select("school_id,role").eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
  if(membershipError||!membership) redirect("/login?error=school-access");

  const [{data:school},{data:rows,error:requestsError}]=await Promise.all([
    supabase.from("schools").select("name").eq("id",membership.school_id).maybeSingle(),
    supabase.from("course_requests")
      .select("id,request_type,status,created_at,availability_text,student_message,school_response,preferred_course_id,student:students(first_name,last_name,contract_number),module:curriculum_modules(name,module_number),practical_lesson:practical_lessons(name,lesson_number),course:theory_courses(title,start_at,location)")
      .eq("school_id",membership.school_id)
      .order("created_at",{ascending:false})
      .limit(100)
  ]);

  const requests=(rows??[]) as unknown as RequestRow[];
  const pending=requests.filter(r=>["submitted","processing"].includes(r.status)).length;
  const canManage=["owner","admin","employee"].includes(membership.role);
  const notice=params.notice?notices[params.notice]:null;

  return <main className="requests-shell">
    <header className="students-admin-header">
      <a className="students-brand" href="/school"><span className="brand-mark"><CarFront size={20}/></span><span><strong>ConduiPRO</strong><small>PORTAIL ÉCOLE</small></span></a>
      <div className="students-head-right"><span>{school?.name??"Votre école"}</span><a href="/school"><ArrowLeft size={15}/> Tableau de bord</a></div>
    </header>
    <section className="requests-content">
      <div className="students-page-heading">
        <div><p className="hero-kicker">GESTION DE L’ÉTABLISSEMENT</p><h1>Demandes des élèves</h1><p>Traitez les inscriptions aux cours et les demandes de leçons pratiques.</p></div>
        <div className="students-total"><Clock3 size={18}/><strong>{pending}</strong><small>à traiter</small></div>
      </div>
      {notice&&<div className="student-notice" role="status">{notice}</div>}
      {requestsError&&<div className="student-notice" role="alert">Impossible de charger les demandes.</div>}
      <div className="requests-toolbar"><span><Filter size={14}/> {requests.length} demande(s) affichée(s)</span><span>Demandes récentes en premier</span></div>
      {requests.length===0?<section className="students-list-panel"><p className="empty-state">Aucune demande reçue pour le moment.</p></section>:
        <div className="requests-list">
          {requests.map((request)=>{
            const isTheory=request.request_type==="theory";
            const editable=canManage&&["submitted","processing"].includes(request.status);
            const name=studentName(request.student);
            return <article className="request-card" key={request.id}>
              <div className="request-card-top">
                <div className="request-kind">{isTheory?<BookOpen size={17}/>:<CarFront size={17}/>}<span>{isTheory?"Cours théorique":"Leçon pratique"}</span></div>
                <span className={"request-status status-"+request.status}>{statusLabel(request.status)}</span>
              </div>
              <div className="request-card-student">
                <div className="request-avatar">{name.split(" ").map(v=>v[0]).slice(0,2).join("")}</div>
                <div><strong>{name}</strong><small>Contrat {request.student?.contract_number??"—"} · Reçue le {dateTime(request.created_at)}</small></div>
              </div>
              <div className="request-card-detail">
                {isTheory?
                  <><strong>{request.module?"Module "+request.module.module_number+" · "+request.module.name:"Module non précisé"}</strong>
                    {request.course&&<span>Séance choisie : {request.course.title} · {dateTime(request.course.start_at)} · {request.course.location??"Lieu à confirmer"}</span>}
                  </>:
                  <><strong>{request.practical_lesson?"Sortie "+request.practical_lesson.lesson_number+" · "+request.practical_lesson.name:"Demande de leçon pratique"}</strong>
                    <span>Disponibilités indiquées : {request.availability_text||"Non précisées"}</span>
                  </>
                }
                {request.student_message&&<span>Message de l’élève : {request.student_message}</span>}
                {request.school_response&&<span className="request-school-response"><MessageSquareText size={14}/> Réponse précédente : {request.school_response}</span>}
              </div>
              {editable?
                <form action={processCourseRequest} className="request-process-form">
                  <input type="hidden" name="request_id" value={request.id}/>
                  <label>Réponse à l’élève<textarea name="school_response" rows={2} maxLength={1000} defaultValue={request.school_response??""} placeholder={isTheory?"Ex. : votre place est confirmée pour la séance sélectionnée.":"Ex. : nous vous contacterons pour confirmer votre horaire."}/></label>
                  <div className="request-process-actions">
                    <label>Décision<select name="status" defaultValue="processing">
                      <option value="processing">Mettre en traitement</option>
                      <option value="approved">Approuver</option>
                      <option value="rejected">Refuser</option>
                    </select></label>
                    <button className="primary-button" type="submit"><CheckCircle2 size={15}/> Enregistrer</button>
                  </div>
                </form>:
                <div className="request-final-state"><span>{statusLabel(request.status)}</span><small>Cette demande n’est plus modifiable.</small></div>
              }
            </article>;
          })}
        </div>
      }
      <footer className="portal-footer"><span>© 2026 ConduiPRO</span><span>Traitement des demandes · {school?.name??"Votre école"}</span></footer>
    </section>
  </main>;
}
