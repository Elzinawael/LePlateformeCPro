"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CarFront, Check, Copy, KeyRound, School, ShieldCheck, UserRound } from "lucide-react";

type TestAccount = { role:string; label:string; email:string; password:string };
type SetupResult = {
  message?:string;
  detail?:string;
  redirectTo?:string;
  accounts?:TestAccount[];
  demoData?:{
    studentContract:string;
    studentPhase:number;
    phaseOneModulesCompleted:number;
    pendingTheoryRequest:boolean;
    pendingPracticalRequest:boolean;
    assignedInstructor:boolean;
    scheduledPracticalLesson:boolean;
    theorySessionTitle:string;
  };
};

export default function FirstSchoolSetupPage() {
  const [token,setToken]=useState("");
  const [email,setEmail]=useState("elzinawael@gmail.com");
  const [firstName,setFirstName]=useState("");
  const [lastName,setLastName]=useState("");
  const [schoolName,setSchoolName]=useState("ConduiPRO — École de démonstration");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [accounts,setAccounts]=useState<TestAccount[]>([]);
  const [copied,setCopied]=useState("");

  async function copy(value:string,key:string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(()=>setCopied(""),1800);
    } catch {
      setError("La copie automatique a échoué. Sélectionne les identifiants affichés.");
    }
  }

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const response=await fetch("/api/bootstrap/first-school",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        cache:"no-store",
        body:JSON.stringify({token,email,firstName,lastName,schoolName,password})
      });
      const result=await response.json() as SetupResult;
      if(!response.ok) throw new Error(result.detail?result.message+" "+result.detail:result.message??"Initialisation impossible.");
      setSuccess(result.message??"Comptes de test créés.");
      setAccounts(result.accounts??[]);
      setPassword("");
      setToken("");
    } catch(cause) {
      setError(cause instanceof Error?cause.message:"Une erreur est survenue.");
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

      {accounts.length===0?
        <>
          <div className="login-heading">
            <h1>Créer le jeu de comptes de test</h1>
            <p>Cette opération crée une école, un propriétaire, un administrateur, un employé, un instructeur et un élève. Elle ne peut être exécutée qu'une seule fois.</p>
          </div>
          <div className="first-school-security"><ShieldCheck size={17}/><span>Les comptes de test seront créés avec des mots de passe temporaires uniques, affichés une seule fois après la création. La clé administrative Supabase reste sur le serveur.</span></div>
          <form onSubmit={submit} className="first-school-form">
            <label htmlFor="bootstrap-token">Code d'initialisation Hostinger</label>
            <div className="login-input"><KeyRound size={17}/><input id="bootstrap-token" type="password" required autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} placeholder="Code configuré dans Hostinger"/></div>

            <label htmlFor="school-name">Nom de l'école de test</label>
            <div className="login-input"><School size={17}/><input id="school-name" required maxLength={160} value={schoolName} onChange={e=>setSchoolName(e.target.value)}/></div>

            <div className="first-school-name-grid">
              <div><label htmlFor="first-name">Prénom du propriétaire</label><div className="login-input"><UserRound size={17}/><input id="first-name" required maxLength={100} value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="Prénom"/></div></div>
              <div><label htmlFor="last-name">Nom du propriétaire</label><div className="login-input"><input id="last-name" required maxLength={100} value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Nom"/></div></div>
            </div>

            <label htmlFor="owner-email">Adresse Gmail du propriétaire</label>
            <div className="login-input"><input id="owner-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></div>

            <label htmlFor="owner-password">Mot de passe du propriétaire (12 caractères minimum)</label>
            <div className="login-input"><KeyRound size={17}/><input id="owner-password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Choisis un mot de passe fort"/></div>

            {error&&<div className="login-error" role="alert">{error}</div>}
            <button className="login-submit" type="submit" disabled={busy}>{busy?"Création des six comptes…":"Créer l'école et les comptes de test"}</button>
          </form>
        </>:
        <>
          <div className="login-heading">
            <h1>Jeu de test créé</h1>
            <p>{success} Copie les identifiants ci-dessous et garde-les en lieu sûr : les mots de passe temporaires ne seront plus réaffichés.</p>
          </div>
          <div className="bootstrap-account-list">
            {accounts.map(account=><article key={account.role}>
              <div><strong>{account.label}</strong><small>{account.email}</small></div>
              <div className="bootstrap-password-row"><code>{account.password}</code><button type="button" onClick={()=>copy(account.email+"\n"+account.password,account.role)} aria-label={"Copier les identifiants "+account.label}>{copied===account.role?<Check size={16}/>:<Copy size={16}/>}</button></div>
            </article>)}
          </div>
          <div className="first-school-security"><ShieldCheck size={17}/><span>Élève de démonstration : contrat DEMO-2026-001, phase 2, cinq modules de phase 1 complétés, une demande théorique, une demande pratique et une sortie assignée à l'instructeur.</span></div>
          <Link className="login-submit bootstrap-login-link" href="/login">Ouvrir la connexion ConduiPRO</Link>
        </>
      }

      {error&&accounts.length>0&&<div className="login-error" role="alert">{error}</div>}
      <p className="login-support"><Link href="/login">Retour à la connexion</Link></p>
    </section>
    <footer className="login-footer">© 2026 ConduiPRO · Québec</footer>
  </main>;
}
