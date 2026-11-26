import { ArrowLeft,CarFront,UserCheck,UserMinus,Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assignInstructor,deactivateInstructorAssignment } from "@/app/actions/assignments";
import { inviteStaffMember } from "@/app/actions/staff";

export const dynamic="force-dynamic";

type Person={id:string;first_name:string|null;last_name:string|null;email:string|null};
type Student={id:string;first_name:string;last_name:string;contract_number:string};
type Assignment={id:string;student_id:string;instructor_user_id:string;active:boolean;assigned_at:string};
type Staff={user_id:string;role:string};

const notices:Record<string,string>={
 assigned:"L’instructeur a été affecté à l’élève.",
 unassigned:"L’affectation a été désactivée.",
 invalid:"Choisissez un instructeur actif et un élève de votre établissement.",
 "assign-error":"L’affectation n’a pas pu être enregistrée.",
 "staff-invited":"L’invitation a été envoyée. Le rôle sera actif dans votre école à la confirmation du courriel.",
 "staff-invite-error":"L’invitation n’a pas pu être envoyée. Vérifiez SMTP et la configuration Supabase.",
 "staff-config":"Configurez APP_BASE_URL et la clé secrète Supabase côté serveur.",
 "staff-invalid":"Vérifiez le nom, l’adresse courriel et le rôle.",
 "staff-role-denied":"Un administrateur ne peut pas inviter un autre administrateur."
};
function personName(person:Person|undefined,id:string) {
 return person?[person.first_name,person.last_name].filter(Boolean).join(" ")||person.email||id.slice(0,8):id.slice(0,8);
}

export default async function InstructorAssignmentsPage({searchParams}:{searchParams:Promise<{notice?:string}>}) {
 const params=await searchParams;
 const supabase=await createSupabaseServerClient();
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user) redirect("/login");
 const {data:profile,error:profileError}=await supabase.from("profiles").select("account_type").eq("id",user.id).maybeSingle();
 if(profileError||profile?.account_type!=="school") redirect("/login?error=school-access");
 const {data:membership,error:membershipError}=await supabase.from("school_members").select("school_id,role").eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
 if(membershipError||!membership) redirect("/login?error=school-access");
 if(!["owner","admin","employee"].includes(membership.role)) redirect("/school/instructor");

 const [{data:school},{data:staff},{data:students},{data:assignments}]=await Promise.all([
  supabase.from("schools").select("name").eq("id",membership.school_id).maybeSingle(),
  supabase.from("school_members").select("user_id,role").eq("school_id",membership.school_id).eq("status","active"),
  supabase.from("students").select("id,first_name,last_name,contract_number").eq("school_id",membership.school_id).eq("status","active").order("last_name").order("first_name").limit(250),
  supabase.from("instructor_student_assignments").select("id,student_id,instructor_user_id,active,assigned_at").eq("school_id",membership.school_id).order("assigned_at",{ascending:false}).limit(300)
 ]);

 const team=(staff??[]) as Staff[];
 const staffIds=team.map(s=>s.user_id);
 let profiles:Person[]=[];
 if(staffIds.length) {
  try {
   const admin=createSupabaseAdminClient();
   const {data}=await admin.from("profiles").select("id,first_name,last_name,email").in("id",staffIds);
   profiles=(data??[]) as Person[];
  } catch {
   profiles=[];
  }
 }
 const profileMap=new Map(profiles.map(p=>[p.id,p]));
 const instructorOptions=team.filter(member=>member.role==="instructor").map(member=>({id:member.user_id,label:personName(profileMap.get(member.user_id),member.user_id)}));
 const canInvite=["owner","admin"].includes(membership.role);
 const activeAssignments=((assignments??[]) as Assignment[]).filter(a=>a.active);
 const studentMap=new Map(((students??[]) as Student[]).map(s=>[s.id,s]));
 const notice=params.notice?notices[params.notice]:null;

 return <main className="instructor-assignments-shell">
  <header className="students-admin-header">
   <a className="students-brand" href="/school"><span className="brand-mark"><CarFront size={20}/></span><span><strong>ConduiPRO</strong><small>PORTAIL ÉCOLE</small></span></a>
   <div className="students-head-right"><span>{school?.name??"Votre école"}</span><a href="/school"><ArrowLeft size={15}/> Tableau de bord</a></div>
  </header>
  <section className="instructor-assignments-content">
   <div className="students-page-heading"><div><p className="hero-kicker">GESTION DE L’ÉQUIPE</p><h1>Affectations instructeurs</h1><p>Assignez les élèves aux instructeurs responsables de leur accompagnement pratique.</p></div><div className="students-total"><Users size={18}/><strong>{activeAssignments.length}</strong><small>affectations actives</small></div></div>
   {notice&&<div className="student-notice" role="status">{notice}</div>}
   {canInvite&&<section className="students-create-panel">
    <div className="panel-head"><div><h2>Inviter un membre de l’équipe</h2><p>Un courriel d’invitation permettra au membre de définir son mot de passe.</p></div><UserCheck size={19}/></div>
    <form action={inviteStaffMember} className="staff-invite-form">
     <label>Prénom<input name="first_name" required maxLength={100} placeholder="Prénom"/></label>
     <label>Nom<input name="last_name" required maxLength={100} placeholder="Nom"/></label>
     <label>Adresse courriel<input name="email" type="email" required maxLength={254} placeholder="collegue@exemple.ca"/></label>
     <label>Rôle<select name="role" defaultValue="instructor"><option value="instructor">Instructeur</option><option value="employee">Employé</option>{membership.role==="owner"&&<option value="admin">Administrateur</option>}</select></label>
     <button className="primary-button" type="submit">Envoyer l’invitation</button>
    </form>
   </section>}
   <section className="students-create-panel">
    <div className="panel-head"><div><h2>Nouvelle affectation</h2><p>Un élève peut être suivi par un ou plusieurs instructeurs.</p></div><UserCheck size={19}/></div>
    {instructorOptions.length===0||!students?.length?<p className="empty-state">{instructorOptions.length===0?"Aucun instructeur actif n’est encore rattaché à cette école.":"Aucun élève actif n’est disponible."}</p>:
     <form action={assignInstructor} className="assignment-create-form">
      <label>Élève<select name="student_id" required defaultValue=""><option value="" disabled>Choisir un élève</option>{(students as Student[]).map(s=><option value={s.id} key={s.id}>{s.first_name} {s.last_name} · {s.contract_number}</option>)}</select></label>
      <label>Instructeur<select name="instructor_user_id" required defaultValue=""><option value="" disabled>Choisir un instructeur</option>{instructorOptions.map(i=><option key={i.id} value={i.id}>{i.label}</option>)}</select></label>
      <button className="primary-button" type="submit">Affecter l’élève</button>
     </form>}
   </section>
   <section className="students-list-panel">
    <div className="panel-head"><div><h2>Équipe active</h2><p>Administrateurs, employés et instructeurs de votre école.</p></div><Users size={18}/></div>
    {team.length===0?<p className="empty-state">Aucun autre membre actif.</p>:<div className="instructor-student-list">{team.map(member=><div key={member.user_id}><span className="assignment-instructor-icon"><UserCheck size={17}/></span><span><strong>{personName(profileMap.get(member.user_id),member.user_id)}</strong><small>{member.role==="admin"?"Administrateur":member.role==="owner"?"Propriétaire":member.role==="employee"?"Employé":"Instructeur"}</small></span></div>)}</div>}
   </section>
   <section className="students-list-panel">
    <div className="panel-head"><div><h2>Affectations actives</h2><p>Les instructeurs voient uniquement les élèves actifs qui leur sont affectés.</p></div><Users size={18}/></div>
    {activeAssignments.length===0?<p className="empty-state">Aucune affectation active.</p>:
     <div className="assignment-list">{activeAssignments.map(a=>{
      const student=studentMap.get(a.student_id);
      return <article key={a.id}>
       <div className="assignment-person"><span className="request-avatar">{student?.first_name?.[0]??"É"}{student?.last_name?.[0]??""}</span><span><strong>{student?student.first_name+" "+student.last_name:"Élève"}</strong><small>Contrat {student?.contract_number??"—"}</small></span></div>
       <div className="assignment-person"><span className="assignment-instructor-icon"><UserCheck size={17}/></span><span><strong>{personName(profileMap.get(a.instructor_user_id),a.instructor_user_id)}</strong><small>Instructeur · Affecté le {new Intl.DateTimeFormat("fr-CA",{day:"numeric",month:"short",year:"numeric",timeZone:"America/Toronto"}).format(new Date(a.assigned_at))}</small></span></div>
       <form action={deactivateInstructorAssignment}><input type="hidden" name="assignment_id" value={a.id}/><button className="assignment-remove" type="submit"><UserMinus size={14}/> Désactiver</button></form>
      </article>;
     })}</div>}
   </section>
   <footer className="portal-footer"><span>© 2026 ConduiPRO</span><span>Affectations et suivi pédagogique</span></footer>
  </section>
 </main>;
}
