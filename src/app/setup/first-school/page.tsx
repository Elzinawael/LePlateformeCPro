"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CarFront, KeyRound, School, ShieldCheck, UserRound } from "lucide-react";

export default function FirstSchoolSetupPage() {
  const router = useRouter();
  const [token,setToken] = useState("");
  const [email,setEmail] = useState("elzinawael@gmail.com");
  const [firstName,setFirstName] = useState("");
  const [lastName,setLastName] = useState("");
  const [schoolName,setSchoolName] = useState("ConduiPRO — École de démonstration");
  const [password,setPassword] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [success,setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const response = await fetch("/api/bootstrap/first-school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ token,email,firstName,lastName,schoolName,password }),
      });
      const result = await response.json() as { message?: string; detail?: string; redirectTo?: string };
      if (!response.ok) throw new Error(result.detail ? result.message + " " + result.detail : result.message ?? "Initialisation impossible.");
      setSuccess(result.message ?? "Compte créé.");
      setPassword("");
      setToken("");
      window.setTimeout(() => router.push(result.redirectTo ?? "/login"), 1500);
    } catch(cause) {
      setError(cause instanceof Error ? cause.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-shell">
    <section className="login-card first-school-card">
      <div className="brand login-brand">
        <div className="brand-mark"><CarFront size={22}/></div>
        <div><strong>ConduiPRO</strong><small>INITIALISATION SÉCURISÉE</small></div>
      </div>
      <div className="login-heading">
        <h1>Créer le premier compte</h1>
        <p>Cette opération crée une école de démonstration et son compte propriétaire. Elle ne peut être exécutée qu'une seule fois.</p>
      </div>
      <div className="first-school-security"><ShieldCheck size={17}/><span>La clé administrative Supabase reste sur le serveur. Choisis ici ton propre mot de passe ; ne le partage pas dans le chat.</span></div>
      <form onSubmit={submit} className="first-school-form">
        <label htmlFor="bootstrap-token">Code d'initialisation Hostinger</label>
        <div className="login-input"><KeyRound size={17}/><input id="bootstrap-token" type="password" required autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} placeholder="Code configuré dans Hostinger"/></div>

        <label htmlFor="school-name">Nom de l'école de test</label>
        <div className="login-input"><School size={17}/><input id="school-name" required maxLength={160} value={schoolName} onChange={e=>setSchoolName(e.target.value)}/></div>

        <div className="first-school-name-grid">
          <div><label htmlFor="first-name">Prénom</label><div className="login-input"><UserRound size={17}/><input id="first-name" required maxLength={100} value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="Prénom"/></div></div>
          <div><label htmlFor="last-name">Nom</label><div className="login-input"><input id="last-name" required maxLength={100} value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Nom"/></div></div>
        </div>

        <label htmlFor="owner-email">Adresse courriel du propriétaire</label>
        <div className="login-input"><input id="owner-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></div>

        <label htmlFor="owner-password">Nouveau mot de passe (12 caractères minimum)</label>
        <div className="login-input"><KeyRound size={17}/><input id="owner-password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Choisis un mot de passe fort"/></div>

        {error&&<div className="login-error" role="alert">{error}</div>}
        {success&&<div className="login-success" role="status">{success}</div>}
        <button className="login-submit" type="submit" disabled={busy}>{busy?"Création du compte…":"Créer l'école et le compte propriétaire"}</button>
      </form>
      <p className="login-support"><Link href="/login">Retour à la connexion</Link></p>
    </section>
    <footer className="login-footer">© 2026 ConduiPRO · Québec</footer>
  </main>;
}
