import { ArrowRight, BookOpen, CarFront, FileCheck2, GraduationCap, ShieldCheck } from "lucide-react";

const features = [
  { icon: BookOpen, label: "Formation théorique", detail: "Modules et séances à venir" },
  { icon: CarFront, label: "Leçons pratiques", detail: "Demandes et progression" },
  { icon: FileCheck2, label: "Documents", detail: "Permis et attestations" },
];

export default function SchoolPortal() {
  return <main className="portal-shell">
    <header className="portal-header"><div className="brand"><div className="brand-mark"><CarFront size={22}/></div><div><strong>ConduiPRO</strong><small>PORTAIL ÉCOLE</small></div></div><span className="portal-tag"><ShieldCheck size={15}/> Espace établissement</span></header>
    <section className="portal-hero"><div className="hero-copy"><span className="hero-kicker">VOTRE ÉCOLE, EN UN SEUL ENDROIT</span><h1>Gérez votre école.<br/><em>En toute simplicité.</em></h1><p>Élèves, cours, équipe, progression et administration réunis dans une plateforme conçue pour les auto-écoles du Québec.</p><a className="primary-button" href="/">Ouvrir le tableau de bord <ArrowRight size={16}/></a></div><div className="hero-art"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="floating-card card-students"><span className="mini-icon"><GraduationCap size={20}/></span><div><strong>Élèves actifs</strong><small>Votre suivi centralisé</small></div><b>128</b></div><div className="floating-card card-progress"><span className="progress-ring"><span>76%</span></span><div><strong>Progression</strong><small>Formation SAAQ</small></div></div><div className="hero-car"><CarFront size={100}/></div></div></section>
    <section className="portal-features">{features.map(({icon:Icon,label,detail})=><article key={label}><div className="feature-icon"><Icon size={21}/></div><strong>{label}</strong><p>{detail}</p></article>)}</section>
    <footer className="portal-footer"><span>© 2026 ConduiPRO</span><span>Plateforme de gestion pour auto-écoles · Québec</span></footer>
  </main>;
}