import { ArrowUpRight, BookOpen, CalendarDays, CarFront, CheckCircle2, Clock3, GraduationCap, Users, Wallet } from "lucide-react";

const metrics = [
  { label: "Élèves actifs", value: "128", change: "+12 ce mois", icon: Users, color: "blue" },
  { label: "Cours théoriques", value: "08", change: "Cette semaine", icon: BookOpen, color: "violet" },
  { label: "Leçons pratiques", value: "42", change: "À planifier", icon: CarFront, color: "orange" },
  { label: "Paiements reçus", value: "12 840 $", change: "Ce mois", icon: Wallet, color: "green" },
];

const requests = [
  { name: "Sophie Martin", type: "Cours théorique · Module 4", date: "Aujourd'hui, 09:42", status: "À traiter" },
  { name: "Yassine Ben Ali", type: "Leçon pratique · Disponibilités", date: "Aujourd'hui, 09:18", status: "À traiter" },
  { name: "Emma Tremblay", type: "Attestation de permis · Phase 2", date: "Hier, 16:05", status: "À vérifier" },
  { name: "Lucas Gagnon", type: "Cours théorique · Module 7", date: "Hier, 14:32", status: "À traiter" },
];

const schedule = [
  { time: "08:30", title: "Cours pratique", person: "Nicolas Roy", detail: "Véhicule · Toyota Corolla", tint: "blue" },
  { time: "10:00", title: "Cours théorique", person: "Module 3 · Conduite sécuritaire", detail: "Salle principale · 8 élèves", tint: "violet" },
  { time: "11:30", title: "Cours pratique", person: "Maya Haddad", detail: "Véhicule · Hyundai Elantra", tint: "orange" },
  { time: "14:00", title: "Cours pratique", person: "Adam Bouchard", detail: "Véhicule · Toyota Corolla", tint: "blue" },
];

export default function Home() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><CarFront size={22}/></div><div><strong>ConduiPRO</strong><small>GESTION AUTO-ÉCOLE</small></div></div>
        <div className="school-switch"><div className="school-avatar">ÉM</div><div><strong>École de conduite Montréal</strong><small>Portail établissement</small></div><ArrowUpRight size={15}/></div>
        <div className="nav-label">MENU PRINCIPAL</div>
        <nav>
          <a className="active" href="#"><span className="nav-icon">◫</span>Vue d'ensemble</a>
          <a href="#"><Users size={18}/> Élèves</a>
          <a href="#"><CalendarDays size={18}/> Calendrier</a>
          <a href="#"><BookOpen size={18}/> Cours théoriques</a>
          <a href="#"><CarFront size={18}/> Leçons pratiques</a>
          <a href="#"><GraduationCap size={18}/> Progression SAAQ</a>
        </nav>
        <div className="nav-label spaced">GESTION</div>
        <nav>
          <a href="#"><Wallet size={18}/> Facturation</a>
          <a href="#"><Clock3 size={18}/> Demandes</a>
          <a href="#"><Users size={18}/> Équipe</a>
        </nav>
        <div className="sidebar-bottom"><div className="help-card"><strong>Besoin d'aide ?</strong><p>Notre équipe est là pour vous accompagner.</p><button>Centre d'aide <ArrowUpRight size={14}/></button></div><div className="user-row"><div className="user-avatar">WA</div><div><strong>Wael Admin</strong><small>Administrateur</small></div><span className="dots">•••</span></div></div>
      </aside>

      <section className="content">
        <header className="topbar"><div className="crumb">Établissement <span>/</span> <b>Vue d'ensemble</b></div><div className="top-actions"><span className="today-pill"><CalendarDays size={15}/> Mardi, 26 novembre</span><button className="icon-button" aria-label="Notifications">♧<i/></button><div className="user-avatar small">WA</div></div></header>
        <div className="page-heading"><div><p className="eyebrow">MARDI 26 NOVEMBRE 2026</p><h1>Bonjour, Wael <span>👋</span></h1><p className="subtitle">Voici ce qui se passe dans votre école aujourd'hui.</p></div><button className="primary-button">+ Ajouter un élève</button></div>
        <div className="metric-grid">{metrics.map((m)=>{const Icon=m.icon;return <article className="metric-card" key={m.label}><div className={"metric-icon "+m.color}><Icon size={19}/></div><p>{m.label}</p><strong>{m.value}</strong><small>{m.change}</small></article>})}</div>
        <div className="dashboard-grid">
          <section className="panel requests-panel"><div className="panel-head"><div><h2>Demandes récentes</h2><p>Les demandes nécessitant votre attention</p></div><button className="link-button">Tout voir <ArrowUpRight size={15}/></button></div><div className="request-list">{requests.map((r,i)=><div className="request-row" key={r.name}><div className={"request-avatar a"+i}>{r.name.split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div className="request-main"><strong>{r.name}</strong><span>{r.type}</span><small>{r.date}</small></div><span className="status">{r.status}</span></div>)}</div></section>
          <section className="panel schedule-panel"><div className="panel-head"><div><h2>Programme du jour</h2><p>Votre calendrier, en un coup d'œil</p></div><button className="link-button">Calendrier <ArrowUpRight size={15}/></button></div><div className="schedule-list">{schedule.map((s,i)=><div className="schedule-row" key={s.time}><div className="schedule-time">{s.time}</div><div className={"schedule-marker "+s.tint}/><div className={"schedule-event "+s.tint}><strong>{s.title}</strong><span>{s.person}</span><small>{s.detail}</small></div></div>)}</div></section>
        </div>
        <section className="panel bottom-panel"><div className="panel-head"><div><h2>Progression des élèves</h2><p>Suivez les étapes de formation et les validations</p></div><button className="link-button">Liste des élèves <ArrowUpRight size={15}/></button></div><div className="progress-summary"><div><span className="progress-dot blue-dot"/><strong>Phase 1</strong><small>Initiation</small><b>32 élèves</b></div><div><span className="progress-dot violet-dot"/><strong>Phase 2</strong><small>Conduite dirigée</small><b>41 élèves</b></div><div><span className="progress-dot orange-dot"/><strong>Phase 3</strong><small>Conduite semi-dirigée</small><b>28 élèves</b></div><div><span className="progress-dot green-dot"/><strong>Phase 4</strong><small>Autonomie</small><b>27 élèves</b></div></div></section>
        <footer><span>© 2026 ConduiPRO</span><span>Plateforme de gestion · Québec</span></footer>
      </section>
    </main>
  );
}