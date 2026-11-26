import Link from "next/link";
import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  CalendarClock,
  CarFront,
  Clock3,
  FileCheck2,
  GraduationCap,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

type RequestRow = {
  id: string;
  request_type: "theory" | "practical";
  status: string;
  created_at: string;
  student: { first_name: string; last_name: string; contract_number: string } | null;
};

type TheorySession = {
  id: string;
  title: string;
  start_at: string;
  location: string | null;
  module: { name: string } | null;
};

type PracticalSession = {
  id: string;
  scheduled_at: string;
  student: { first_name: string; last_name: string } | null;
  lesson: { name: string } | null;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("fr-CA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Toronto",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-CA", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Toronto",
  }).format(new Date(value));
}

function requestLabel(type: RequestRow["request_type"]) {
  return type === "theory" ? "Demande de cours théorique" : "Demande de leçon pratique";
}

function statusLabel(status: string) {
  if (status === "submitted") return "À traiter";
  if (status === "processing") return "En traitement";
  if (status === "approved") return "Approuvée";
  if (status === "rejected") return "Refusée";
  return status;
}

export default async function SchoolPortal() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("first_name,last_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("school_members")
      .select("school_id,role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
  ]);

  if (!membership) redirect("/login?error=school-access");

  const schoolId = membership.school_id;
  const [{ data: school }, studentCount, theoryCount, practicalCount, pendingRequests, pendingPermits, requestResult, theoryResult, practicalResult] =
    await Promise.all([
      supabase.from("schools").select("name,school_code").eq("id", schoolId).maybeSingle(),
      supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "active"),
      supabase.from("theory_courses").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "scheduled"),
      supabase.from("student_practical_progress").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "scheduled"),
      supabase.from("course_requests").select("id", { count: "exact", head: true }).eq("school_id", schoolId).in("status", ["submitted", "processing"]),
      supabase.from("student_licenses").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("verification_status", "pending"),
      supabase
        .from("course_requests")
        .select("id,request_type,status,created_at,student:students(first_name,last_name,contract_number)")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("theory_courses")
        .select("id,title,start_at,location,module:curriculum_modules(name)")
        .eq("school_id", schoolId)
        .eq("status", "scheduled")
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(4),
      supabase
        .from("student_practical_progress")
        .select("id,scheduled_at,student:students(first_name,last_name),lesson:practical_lessons(name)")
        .eq("school_id", schoolId)
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(4),
    ]);

  const requests = (requestResult.data ?? []) as unknown as RequestRow[];
  const theorySessions = (theoryResult.data ?? []) as unknown as TheorySession[];
  const practicalSessions = (practicalResult.data ?? []) as unknown as PracticalSession[];
  const firstName = profile?.first_name?.trim() || "";
  const schoolName = school?.name || "Votre établissement";
  const today = new Intl.DateTimeFormat("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Toronto",
  }).format(new Date());

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><CarFront size={22} /></div>
          <div><strong>ConduiPRO</strong><small>GESTION AUTO-ÉCOLE</small></div>
        </div>
        <div className="school-switch">
          <div className="school-avatar">{schoolName.slice(0, 2).toUpperCase()}</div>
          <div><strong>{schoolName}</strong><small>Code école : {school?.school_code ?? "—"}</small></div>
        </div>
        <div className="nav-label">ESPACE ÉCOLE</div>
        <nav>
          <a className="active" href="#overview"><span className="nav-icon">◫</span>Vue d&apos;ensemble</a>
          <Link href="/school/requests"><Clock3 size={18} /> Demandes</Link>
          
          <Link href="/school/students"><Users size={18} /> Élèves</Link>
        </nav>
        <div className="nav-label spaced">FORMATION</div>
        <nav>
          <Link href="/school/courses"><BookOpen size={18} /> Séances théoriques</Link>
          <Link href="/school/practical"><CarFront size={18} /> Leçons pratiques</Link>
          <Link href="/school/documents"><FileCheck2 size={18} /> Documents à vérifier</Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <strong>Portail établissement</strong>
            <p>Les données affichées proviennent directement de votre compte école.</p>
          </div>
          <div className="user-row">
            <div className="user-avatar">{(profile?.first_name?.[0] || "C") + (profile?.last_name?.[0] || "P")}</div>
            <div><strong>{[profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Compte école"}</strong><small>Propriétaire</small></div>
            <form action={signOut}><button className="dots" type="submit" aria-label="Se déconnecter">↪</button></form>
          </div>
        </div>
      </aside>

      <section className="content" id="overview">
        <header className="topbar">
          <div className="crumb">Établissement <span>/</span> <b>Vue d&apos;ensemble</b></div>
          <div className="top-actions">
            <span className="today-pill"><CalendarDays size={15} />{today}</span>
            <span className="icon-button" aria-label="Notifications"><Bell size={16} /></span>
            <div className="user-avatar small">{(profile?.first_name?.[0] || "C") + (profile?.last_name?.[0] || "P")}</div>
          </div>
        </header>

        <div className="page-heading">
          <div>
            <p className="eyebrow">{schoolName.toLocaleUpperCase("fr-CA")}</p>
            <h1>Bonjour{firstName ? ", " + firstName : ""} <span>👋</span></h1>
            <p className="subtitle">Voici l&apos;activité réelle de votre établissement.</p>
          </div>
          <Link className="primary-button" href="/school/requests">Consulter les demandes <ArrowRight size={15} /></Link>
        </div>

        <div className="metric-grid">
          <article className="metric-card"><div className="metric-icon blue"><Users size={19} /></div><p>Élèves actifs</p><strong>{studentCount.count ?? 0}</strong><small>Inscrits dans votre établissement</small></article>
          <article className="metric-card"><div className="metric-icon violet"><BookOpen size={19} /></div><p>Cours théoriques</p><strong>{theoryCount.count ?? 0}</strong><small>Séances planifiées</small></article>
          <article className="metric-card"><div className="metric-icon orange"><CarFront size={19} /></div><p>Leçons pratiques</p><strong>{practicalCount.count ?? 0}</strong><small>Leçons planifiées</small></article>
          <article className="metric-card"><div className="metric-icon green"><Clock3 size={19} /></div><p>Demandes à traiter</p><strong>{pendingRequests.count ?? 0}</strong><small>Soumises ou en traitement</small></article>
        </div>

        <div className="dashboard-grid">
          <section className="panel requests-panel" id="requests">
            <div className="panel-head"><div><h2>Demandes récentes</h2><p>Les cinq dernières demandes reçues</p></div><Link className="link-button" href="/school/documents">{pendingPermits.count ?? 0} permis à vérifier</Link></div>
            <div className="request-list">
              {requests.length === 0 ? <p className="empty-state">Aucune demande pour le moment.</p> : requests.map((request) => {
                const student = request.student;
                const name = student ? student.first_name + " " + student.last_name : "Élève";
                return (
                  <div className="request-row" key={request.id}>
                    <div className="request-avatar">{name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
                    <div className="request-main">
                      <strong>{name}</strong>
                      <span>{requestLabel(request.request_type)}</span>
                      <small>{student?.contract_number || "Contrat non indiqué"} · {formatDate(request.created_at)}</small>
                    </div>
                    <span className="status">{statusLabel(request.status)}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel schedule-panel" id="schedule">
            <div className="panel-head"><div><h2>Prochaines séances</h2><p>Les séances à venir dans votre école</p></div><CalendarClock size={18} /></div>
            <div className="schedule-list">
              {[
                ...theorySessions.map((session) => ({
                  id: "theory-" + session.id,
                  time: formatTime(session.start_at),
                  date: formatDate(session.start_at),
                  title: session.title,
                  person: session.module?.name || "Cours théorique",
                  detail: session.location || "Lieu à confirmer",
                  tint: "violet",
                })),
                ...practicalSessions.map((session) => ({
                  id: "practical-" + session.id,
                  time: formatTime(session.scheduled_at),
                  date: formatDate(session.scheduled_at),
                  title: session.lesson?.name || "Leçon pratique",
                  person: session.student ? session.student.first_name + " " + session.student.last_name : "Élève",
                  detail: "Leçon pratique planifiée",
                  tint: "orange",
                })),
              ].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).slice(0, 6).map((session) => (
                <div className="schedule-row" key={session.id}>
                  <div className="schedule-time">{session.time}<br /><small>{session.date}</small></div>
                  <div className={"schedule-marker " + session.tint} />
                  <div className={"schedule-event " + session.tint}>
                    <strong>{session.title}</strong><span>{session.person}</span><small>{session.detail}</small>
                  </div>
                </div>
              ))}
              {theorySessions.length === 0 && practicalSessions.length === 0 && <p className="empty-state">Aucune séance à venir.</p>}
            </div>
          </section>
        </div>

        <section className="panel bottom-panel" id="students">
          <div className="panel-head"><div><h2>Gestion de la formation</h2><p>Suivi basé sur les enregistrements de votre établissement</p></div><GraduationCap size={19} /></div>
          <div className="progress-summary">
            <div><span className="progress-dot blue-dot" /><strong>Élèves</strong><small>Comptes et contrats</small><b>{studentCount.count ?? 0} actifs</b></div>
            <div><span className="progress-dot violet-dot" /><strong>Théorie</strong><small>Sessions programmées</small><b>{theoryCount.count ?? 0}</b></div>
            <div><span className="progress-dot orange-dot" /><strong>Pratique</strong><small>Leçons planifiées</small><b>{practicalCount.count ?? 0}</b></div>
            <div id="documents"><span className="progress-dot green-dot" /><strong>Permis</strong><small>À examiner par l&apos;école</small><b>{pendingPermits.count ?? 0} en attente</b></div>
          </div>
        </section>
        <footer><span>© 2026 ConduiPRO</span><span>Portail établissement · Québec</span></footer>
      </section>
    </main>
  );
}
