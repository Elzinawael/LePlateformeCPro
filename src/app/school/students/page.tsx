import { ArrowLeft, CarFront, Search, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createStudent } from "@/app/actions/school";
import { inviteStudent } from "@/app/actions/invitations";

export const dynamic="force-dynamic";

type StudentRow={
  id:string;
  contract_number:string;
  first_name:string;
  last_name:string;
  email:string|null;
  phone:string|null;
  enrollment_date:string;
  status:string;
  current_phase_id:string|null;
  user_id:string|null;
};
type PhaseRow={id:string;phase_number:number;name:string};

const notices:Record<string,string>={
  "student-created":"La fiche élève a été créée. L’activation de son compte et l’invitation sécurisée seront ajoutées dans l’étape suivante.",
  "contract-exists":"Ce numéro de contrat existe déjà dans votre établissement.",
  "student-invalid":"Vérifiez le numéro de contrat et les coordonnées saisies.",
  "student-error":"La fiche n’a pas pu être créée. Vérifiez les informations et réessayez.",
  "forbidden":"Votre rôle ne permet pas de créer un élève.",
  "invite-sent":"L’invitation a été envoyée par courriel et le compte est lié au dossier.",
  "invite-error":"L’invitation n’a pas pu être envoyée. Vérifiez la configuration Auth et SMTP.",
  "invite-config":"La clé serveur et l’URL publique doivent être configurées pour envoyer des invitations.",
  "email-required":"Ajoutez une adresse courriel au dossier avant d’envoyer l’invitation.",
  "already-invited":"Ce dossier est déjà associé à un compte.",
};

export default async function StudentsPage({searchParams}:{searchParams:Promise<{notice?:string}>}) {
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

  const [{data:school},{data:rows,error:studentsError}]=await Promise.all([
    supabase.from("schools").select("name").eq("id",membership.school_id).maybeSingle(),
    supabase.from("students")
      .select("id,contract_number,first_name,last_name,email,phone,enrollment_date,status,current_phase_id,user_id")
      .eq("school_id",membership.school_id)
      .order("created_at",{ascending:false})
      .limit(100)
  ]);
  const students=(rows??[]) as StudentRow[];
  const phaseIds=[...new Set(students.map(s=>s.current_phase_id).filter((id):id is string=>!!id))];
  const {data:phaseRows}=phaseIds.length
    ?await supabase.from("curriculum_phases").select("id,phase_number,name").in("id",phaseIds)
    :{data:[]};
  const phases=(phaseRows??[]) as PhaseRow[];
  const phaseById=new Map(phases.map(p=>[p.id,"Phase "+p.phase_number+" · "+p.name]));
  const schoolName=school?.name??"Votre école";
  const canManage=["owner","admin","employee"].includes(membership.role);
  const notice=params.notice?notices[params.notice]:null;

  return <main className="students-admin-shell">
    <header className="students-admin-header">
      <a className="students-brand" href="/school"><span className="brand-mark"><CarFront size={20}/></span><span><strong>ConduiPRO</strong><small>PORTAIL ÉCOLE</small></span></a>
      <div className="students-head-right"><span>{schoolName}</span><a href="/school"><ArrowLeft size={15}/> Tableau de bord</a></div>
    </header>
    <section className="students-admin-content">
      <div className="students-page-heading">
        <div><p className="hero-kicker">GESTION DE L’ÉTABLISSEMENT</p><h1>Élèves</h1><p>Consultez les dossiers inscrits et créez une nouvelle fiche élève.</p></div>
        <div className="students-total"><Users size={18}/><strong>{students.length}</strong><small>sur cette page</small></div>
      </div>
      {notice&&<div className="student-notice" role="status">{notice}</div>}
      {studentsError&&<div className="student-notice" role="alert">Impossible de charger les dossiers élèves.</div>}

      {canManage&&<section className="students-create-panel">
        <div className="panel-head"><div><h2>Créer une fiche élève</h2><p>Le numéro de contrat sert d’identifiant administratif.</p></div><UserPlus size={19}/></div>
        <form action={createStudent} className="students-create-form">
          <label>Numéro de contrat<input name="contract_number" placeholder="Ex. CP-2026-0184" required maxLength={40}/></label>
          <label>Prénom<input name="first_name" placeholder="Prénom" required maxLength={100}/></label>
          <label>Nom<input name="last_name" placeholder="Nom" required maxLength={100}/></label>
          <label>Courriel (facultatif)<input name="email" type="email" placeholder="eleve@exemple.ca" maxLength={254}/></label>
          <label>Téléphone (facultatif)<input name="phone" type="tel" placeholder="514 555-0100" maxLength={40}/></label>
          <label>Date de naissance (facultatif)<input name="date_of_birth" type="date"/></label>
          <div className="students-create-submit"><button className="primary-button" type="submit"><UserPlus size={15}/> Créer la fiche</button><small>La création du dossier ne crée pas encore les identifiants de connexion.</small></div>
        </form>
      </section>}

      <section className="students-list-panel">
        <div className="panel-head"><div><h2>Liste des élèves</h2><p>Affichage des 100 derniers dossiers accessibles selon votre rôle.</p></div><Search size={18}/></div>
        {students.length===0?<p className="empty-state">Aucun élève enregistré. Créez la première fiche à l’aide du formulaire.</p>:
        <div className="students-table-wrap"><table className="students-table">
          <thead><tr><th>Élève</th><th>Contrat</th><th>Phase</th><th>Inscription</th><th>Compte</th><th>Statut</th></tr></thead>
          <tbody>{students.map(student=><tr key={student.id}>
            <td><Link className="student-record-link" href={"/school/students/"+student.id}><strong>{student.first_name} {student.last_name}</strong><small>{student.email||student.phone||"Coordonnées non renseignées"}</small></Link></td>
            <td>{student.contract_number}</td>
            <td>{student.current_phase_id?phaseById.get(student.current_phase_id)??"Phase non définie":"À assigner"}</td>
            <td>{new Intl.DateTimeFormat("fr-CA",{day:"numeric",month:"short",year:"numeric",timeZone:"America/Toronto"}).format(new Date(student.enrollment_date))}</td>
            <td>
              {student.user_id
                ? <span className="account-active">Activé</span>
                : student.email && canManage
                  ? <form action={inviteStudent} className="invite-student-form">
                      <input type="hidden" name="student_id" value={student.id}/>
                      <button type="submit">Envoyer l’invitation</button>
                    </form>
                  : <span className="account-pending">{student.email?"À inviter":"Courriel requis"}</span>}
            </td>
            <td>{student.status==="active"?"Actif":student.status}</td>
          </tr>)}</tbody>
        </table></div>}
      </section>
      <footer className="portal-footer"><span>© 2026 ConduiPRO</span><span>Gestion confidentielle des dossiers élèves</span></footer>
    </section>
  </main>;
}
