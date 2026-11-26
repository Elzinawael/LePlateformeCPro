import { ArrowLeft, CarFront, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CreateStudentForm from "./CreateStudentForm";

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

export default async function StudentsPage() {
  const supabase=await createSupabaseServerClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)redirect("/login");

  const {data:profile,error:profileError}=await supabase.from("profiles")
    .select("account_type").eq("id",user.id).maybeSingle();
  if(profileError||profile?.account_type!=="school")redirect("/login?error=school-access");

  const {data:membership,error:membershipError}=await supabase.from("school_members")
    .select("school_id,role").eq("user_id",user.id).eq("status","active").eq("role","owner").maybeSingle();
  if(membershipError||!membership)redirect("/login?error=school-access");

  const [{data:school},{data:rows,error:studentsError}]=await Promise.all([
    supabase.from("schools").select("name,school_code").eq("id",membership.school_id).maybeSingle(),
    supabase.from("students").select("id,contract_number,first_name,last_name,email,phone,enrollment_date,status,current_phase_id,user_id")
      .eq("school_id",membership.school_id).order("created_at",{ascending:false}).limit(250)
  ]);
  const students=(rows??[]) as StudentRow[];
  const phaseIds=[...new Set(students.map(s=>s.current_phase_id).filter((id):id is string=>!!id))];
  const {data:phaseRows}=phaseIds.length
    ?await supabase.from("curriculum_phases").select("id,phase_number,name").in("id",phaseIds)
    :{data:[]};
  const phaseById=new Map(((phaseRows??[]) as PhaseRow[]).map(p=>[p.id,"Phase "+p.phase_number+" · "+p.name]));
  const schoolName=school?.name??"Votre école";

  return <main className="students-admin-shell">
    <header className="students-admin-header">
      <a className="students-brand" href="/school"><span className="brand-mark"><CarFront size={20}/></span><span><strong>ConduiPRO</strong><small>PORTAIL ÉCOLE</small></span></a>
      <div className="students-head-right"><span>{schoolName}</span><Link href="/school"><ArrowLeft size={15}/> Tableau de bord</Link></div>
    </header>
    <section className="students-admin-content">
      <div className="students-page-heading">
        <div><p className="hero-kicker">GESTION DE L’ÉTABLISSEMENT</p><h1>Élèves</h1><p>Créez un dossier et le compte de connexion de l'élève en une seule opération.</p></div>
        <div className="students-total"><Users size={18}/><strong>{students.length}</strong><small>élèves</small></div>
      </div>
      {studentsError&&<div className="student-notice" role="alert">Impossible de charger les dossiers élèves.</div>}

      <CreateStudentForm schoolCode={school?.school_code??""}/>

      <section className="students-list-panel">
        <div className="panel-head"><div><h2>Liste des élèves</h2><p>Les dossiers de votre établissement et leur état de connexion.</p></div><Users size={18}/></div>
        {students.length===0?<p className="empty-state">Aucun élève enregistré. Créez le premier dossier ci-dessus.</p>:
        <div className="students-table-wrap"><table className="students-table">
          <thead><tr><th>Élève</th><th>Contrat / Identifiant</th><th>Phase actuelle</th><th>Inscription</th><th>Compte</th><th>Statut</th></tr></thead>
          <tbody>{students.map(student=><tr key={student.id}>
            <td><Link className="student-record-link" href={"/school/students/"+student.id}><strong>{student.first_name} {student.last_name}</strong><small>{student.email||student.phone||"Coordonnées non renseignées"}</small></Link></td>
            <td>{student.contract_number}</td>
            <td>{student.current_phase_id?phaseById.get(student.current_phase_id)??"Phase non définie":"À définir"}</td>
            <td>{new Intl.DateTimeFormat("fr-CA",{day:"numeric",month:"short",year:"numeric",timeZone:"America/Toronto"}).format(new Date(student.enrollment_date))}</td>
            <td>{student.user_id?<span className="account-active">Compte créé</span>:<span className="account-pending">À vérifier</span>}</td>
            <td>{student.status==="active"?"Actif":student.status}</td>
          </tr>)}</tbody>
        </table></div>}
      </section>
      <footer className="portal-footer"><span>© 2026 ConduiPRO</span><span>Gestion confidentielle des dossiers élèves</span></footer>
    </section>
  </main>;
}
