import { NextRequest, NextResponse } from "next/server";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreatedAccount = { role:string; label:string; email:string; password:string; userId:string };

function json(message:string,status:number,extra:Record<string,unknown>={}) {
  return NextResponse.json({message,...extra},{
    status,
    headers:{
      "Cache-Control":"no-store, max-age=0",
      "Pragma":"no-cache",
      "X-Content-Type-Options":"nosniff"
    }
  });
}
function safeEqual(left:string,right:string) {
  const a=Buffer.from(left), b=Buffer.from(right);
  return a.length===b.length&&timingSafeEqual(a,b);
}
function testAlias(ownerEmail:string,tag:string) {
  const [local,domain]=ownerEmail.split("@");
  if(!local||!domain) throw new Error("Courriel propriétaire invalide.");
  return domain.toLowerCase()==="gmail.com"
    ? local.split("+")[0]+"+"+tag+"@"+domain
    : local+"+"+tag+"@"+domain;
}
function tempPassword() {
  return randomBytes(24).toString("base64url");
}

export async function POST(request:NextRequest) {
  const expectedToken=process.env.CONDUIPRO_BOOTSTRAP_TOKEN;
  if(!expectedToken||expectedToken.length<32) {
    return json("L'initialisation n'est pas configurée sur Hostinger.",404);
  }

  let body:Record<string,unknown>;
  try { body=await request.json(); }
  catch { return json("Requête invalide.",400); }

  const token=typeof body.token==="string"?body.token:"";
  if(!safeEqual(token,expectedToken)) return json("Code d'initialisation invalide.",401);

  const email=typeof body.email==="string"?body.email.trim().toLowerCase():"";
  const firstName=typeof body.firstName==="string"?body.firstName.trim():"";
  const lastName=typeof body.lastName==="string"?body.lastName.trim():"";
  const schoolName=typeof body.schoolName==="string"?body.schoolName.trim():"";
  const password=typeof body.password==="string"?body.password:"";

  if(!/^[^\s@]+@gmail\.com$/i.test(email)||email.length>254
    ||!firstName||firstName.length>100||!lastName||lastName.length>100
    ||!schoolName||schoolName.length>160||password.length<12||password.length>128) {
    return json("Vérifie les informations. Cette configuration de test utilise une adresse Gmail et un mot de passe de 12 caractères minimum.",400);
  }

  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try { admin=createSupabaseAdminClient(); }
  catch { return json("La clé secrète Supabase n'est pas configurée côté serveur.",503); }

  const [{count:schoolCount,error:schoolCountError},{count:memberCount,error:memberCountError}] =
    await Promise.all([
      admin.from("schools").select("id",{count:"exact",head:true}),
      admin.from("school_members").select("id",{count:"exact",head:true})
    ]);
  if(schoolCountError||memberCountError) return json("Impossible de vérifier l'état initial de la base.",503);
  if((schoolCount??0)>0||(memberCount??0)>0) {
    return json("Une école ou un membre existe déjà. L'initialisation unique est verrouillée.",409);
  }

  const roles=[
    {role:"admin",label:"Administrateur",tag:"admin",firstName:"Admin",lastName:"Test",accountType:"school"},
    {role:"employee",label:"Employé",tag:"employee",firstName:"Employe",lastName:"Test",accountType:"school"},
    {role:"instructor",label:"Instructeur",tag:"instructor",firstName:"Instructeur",lastName:"Test",accountType:"school"},
    {role:"student",label:"Élève",tag:"student",firstName:"Eleve",lastName:"Test",accountType:"student"}
  ] as const;

  const emails=[email,...roles.map(r=>testAlias(email,r.tag))];
  if(new Set(emails).size!==emails.length) return json("Les adresses de test générées ne sont pas uniques.",400);

  const {error:guardError}=await admin.from("conduipro_bootstrap_guard")
    .insert({singleton:true,owner_email:email});
  if(guardError) return json("Cette initialisation a déjà été utilisée ou est en cours. Les doublons sont bloqués.",409);

  const created:CreatedAccount[]=[];
  let schoolId:string|null=null;
  let studentId:string|null=null;

  async function createAuthAccount(args:{email:string;password:string;firstName:string;lastName:string;accountType:"school"|"student";role:string}) {
    const {data,error}=await admin.auth.admin.createUser({
      email:args.email,
      password:args.password,
      email_confirm:true,
      user_metadata:{
        first_name:args.firstName,
        last_name:args.lastName,
        account_type:args.accountType,
        role:args.role
      }
    });
    if(error||!data.user) throw new Error(error?.message??"Création de compte Auth impossible.");
    const {error:profileError}=await admin.from("profiles").insert({
      id:data.user.id,
      first_name:args.firstName,
      last_name:args.lastName,
      email:args.email,
      account_type:args.accountType
    });
    if(profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw profileError;
    }
    return data.user;
  }

  try {
    const owner=await createAuthAccount({
      email,password,firstName,lastName,accountType:"school",role:"owner"
    });
    created.push({role:"owner",label:"Propriétaire",email,password,userId:owner.id});

    const {data:school,error:schoolError}=await admin.from("schools")
      .insert({name:schoolName,email,province:"Québec",status:"active"})
      .select("id").single();
    if(schoolError||!school) throw new Error(schoolError?.message??"Création de l'école impossible.");
    schoolId=school.id;

    const {error:ownerMetaError}=await admin.auth.admin.updateUserById(owner.id,{
      user_metadata:{
        first_name:firstName,last_name:lastName,account_type:"school",
        role:"owner",school_id:schoolId
      }
    });
    if(ownerMetaError) throw ownerMetaError;

    const {error:ownerMembershipError}=await admin.from("school_members").insert({
      school_id:schoolId,user_id:owner.id,role:"owner",status:"active"
    });
    if(ownerMembershipError) throw ownerMembershipError;

    const staffUsers:Record<string,string>={};
    for(const role of roles) {
      const generatedPassword=tempPassword();
      const generatedEmail=testAlias(email,role.tag);
      const user=await createAuthAccount({
        email:generatedEmail,password:generatedPassword,
        firstName:role.firstName,lastName:role.lastName,
        accountType:role.accountType,role:role.role
      });
      created.push({
        role:role.role,label:role.label,email:generatedEmail,
        password:generatedPassword,userId:user.id
      });
      staffUsers[role.role]=user.id;
      await admin.auth.admin.updateUserById(user.id,{
        user_metadata:{
          first_name:role.firstName,last_name:role.lastName,
          account_type:role.accountType,role:role.role,school_id:schoolId
        }
      }).then(({error})=>{if(error) throw error;});

      if(role.role!=="student") {
        const {error}=await admin.from("school_members").insert({
          school_id:schoolId,user_id:user.id,role:role.role,status:"active"
        });
        if(error) throw error;
      } else {
        // The student account receives a real student record after the school and roles exist.
        const {data:phaseOne,error:phaseError}=await admin.from("curriculum_phases")
          .select("id").is("school_id",null).eq("phase_number",1).single();
        if(phaseError||!phaseOne) throw new Error("Phase 1 du programme SAAQ introuvable.");
        const {data:student,error:studentError}=await admin.from("students")
          .insert({
            school_id:schoolId,user_id:user.id,
            contract_number:"DEMO-2026-001",
            first_name:role.firstName,last_name:role.lastName,email:generatedEmail,
            city:"Montréal",status:"active",
            current_phase_id:phaseOne.id,
            current_phase_started_at:new Date(Date.now()-35*86400000).toISOString(),
            enrollment_date:new Date(Date.now()-35*86400000).toISOString().slice(0,10),
            created_by:owner.id
          })
          .select("id").single();
        if(studentError||!student) throw new Error(studentError?.message??"Création de la fiche élève impossible.");
        studentId=student.id;
      }
    }

    // Prepare a clearly labelled demo history that satisfies the Phase 1 transition rules.
    const {data:globalPhaseOne,error:globalPhaseOneError}=await admin.from("curriculum_phases")
      .select("id").is("school_id",null).eq("phase_number",1).single();
    if(globalPhaseOneError||!globalPhaseOne||!studentId) {
      throw new Error("La phase 1 du programme SAAQ est introuvable.");
    }

    const {data:phaseOneModules,error:modulesError}=await admin.from("curriculum_modules")
      .select("id,module_number")
      .eq("phase_id",globalPhaseOne.id)
      .gte("module_number",1).lte("module_number",5);
    if(modulesError||!phaseOneModules||phaseOneModules.length!==5) {
      throw new Error("Les cinq modules de la phase 1 ne sont pas disponibles.");
    }

    const modulesOneToFour=phaseOneModules.filter(m=>m.module_number<5).map(m=>m.id);
    const {error:previousModulesError}=await admin.from("student_module_progress")
      .update({
        status:"completed",
        completed_at:new Date(Date.now()-30*86400000).toISOString(),
        validated_by:created[0].userId
      }).eq("student_id",studentId).in("module_id",modulesOneToFour);
    if(previousModulesError) throw previousModulesError;

    const moduleFive=phaseOneModules.find(m=>m.module_number===5);
    if(!moduleFive) throw new Error("Le module d'évaluation 5 est introuvable.");
    const {error:moduleFiveError}=await admin.from("student_module_progress")
      .update({
        status:"completed",
        completed_at:new Date(Date.now()-29*86400000).toISOString(),
        validated_by:created[0].userId
      }).eq("student_id",studentId).eq("module_id",moduleFive.id);
    if(moduleFiveError) throw moduleFiveError;

    const {data:phaseTwo,error:phaseTwoError}=await admin.from("curriculum_phases")
      .select("id").is("school_id",null).eq("phase_number",2).single();
    if(phaseTwoError||!phaseTwo) throw new Error("La phase 2 du programme SAAQ est introuvable.");

    const [{data:phaseTwoModule,error:phaseTwoModuleError},{data:phaseTwoLesson,error:phaseTwoLessonError}]=
      await Promise.all([
        admin.from("curriculum_modules").select("id,module_number,name")
          .eq("phase_id",phaseTwo.id).eq("module_number",6).single(),
        admin.from("practical_lessons").select("id,lesson_number,name")
          .eq("phase_id",phaseTwo.id).eq("lesson_number",1).single()
      ]);

    if(phaseTwoModuleError||!phaseTwoModule||phaseTwoLessonError||!phaseTwoLesson) {
      throw new Error("Le programme de phase 2 est incomplet.");
    }

    const {error:advanceError}=await admin.from("students").update({
      current_phase_id:phaseTwo.id
    }).eq("id",studentId).eq("school_id",schoolId);
    if(advanceError) throw advanceError;

    const instructorId=staffUsers.instructor;
    const {error:assignmentError}=await admin.from("instructor_student_assignments").insert({
      school_id:schoolId,student_id:studentId,instructor_user_id:instructorId,
      assigned_by:created[0].userId,active:true
    });
    if(assignmentError) throw assignmentError;

    const futureCourseStart=new Date(Date.now()+8*86400000);
    futureCourseStart.setUTCHours(18,0,0,0);
    const futureCourseEnd=new Date(futureCourseStart.getTime()+2*60*60000);
    const {data:course,error:courseError}=await admin.from("theory_courses").insert({
      school_id:schoolId,module_id:phaseTwoModule.id,
      title:"Séance de démonstration — Module 6",
      start_at:futureCourseStart.toISOString(),
      end_at:futureCourseEnd.toISOString(),
      capacity:12,location:"École ConduiPRO — salle de démonstration",
      status:"scheduled",created_by:created[0].userId
    }).select("id").single();
    if(courseError||!course) throw new Error(courseError?.message??"Création de la séance théorique impossible.");

    const {error:theoryRequestError}=await admin.from("course_requests").insert({
      school_id:schoolId,student_id:studentId,request_type:"theory",
      module_id:phaseTwoModule.id,preferred_course_id:course.id,
      status:"submitted",student_message:"Demande de test — séance théorique."
    });
    if(theoryRequestError) throw theoryRequestError;

    const {error:practicalRequestError}=await admin.from("course_requests").insert({
      school_id:schoolId,student_id:studentId,request_type:"practical",
      practical_lesson_id:phaseTwoLesson.id,
      availability_text:"Lundi au vendredi après 16 h — demande de démonstration.",
      status:"submitted",student_message:"Demande de test — leçon pratique."
    });
    if(practicalRequestError) throw practicalRequestError;

    const practicalTime=new Date(Date.now()+10*86400000);
    practicalTime.setUTCHours(15,0,0,0);
    const {error:practicalScheduleError}=await admin.from("student_practical_progress")
      .update({
        status:"scheduled",
        scheduled_at:practicalTime.toISOString(),
        instructor_user_id:instructorId,
        notes:"Séance préchargée pour les tests ConduiPRO."
      })
      .eq("school_id",schoolId)
      .eq("student_id",studentId)
      .eq("lesson_id",phaseTwoLesson.id);
    if(practicalScheduleError) throw practicalScheduleError;

    return json("Le jeu de données de démonstration a été créé.",201,{
      schoolName,
      accounts:created.map(({role,label,email,password})=>({role,label,email,password})),
      demoData:{
        studentContract:"DEMO-2026-001",
        studentPhase:2,
        phaseOneModulesCompleted:5,
        pendingTheoryRequest:true,
        pendingPracticalRequest:true,
        assignedInstructor:true,
        scheduledPracticalLesson:true,
        theorySessionTitle:"Séance de démonstration — Module 6"
      },
      redirectTo:"/login?bootstrap=success"
    });
  } catch(error) {
    // Remove the whole demo school, all related records, profiles and Auth accounts.
    if(schoolId) await admin.from("schools").delete().eq("id",schoolId);
    for(const account of created) {
      await admin.from("profiles").delete().eq("id",account.userId);
      await admin.auth.admin.deleteUser(account.userId);
    }
    await admin.from("conduipro_bootstrap_guard").delete().eq("singleton",true);
    const message=error instanceof Error?error.message:"Erreur inconnue.";
    return json("La création du jeu de démonstration a échoué. Les enregistrements partiels ont été nettoyés.",500,{detail:message});
  }
}
