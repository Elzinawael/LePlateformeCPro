"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CarFront, Mail } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email,setEmail]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [sent,setSent]=useState(false);

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const supabase=createSupabaseBrowserClient();
      const redirectTo=window.location.origin+"/auth/callback";
      const {error:resetError}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo});
      if(resetError) throw resetError;
      setSent(true);
    } catch(cause) {
      setError(cause instanceof Error?cause.message:"La demande n’a pas pu être envoyée.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-shell">
    <div className="login-card">
      <div className="brand login-brand"><div className="brand-mark"><CarFront size={22}/></div><div><strong>ConduiPRO</strong><small>GESTION AUTO-ÉCOLE</small></div></div>
      <div className="login-heading"><h1>Mot de passe oublié ?</h1><p>Nous vous enverrons un lien sécurisé pour en choisir un nouveau.</p></div>
      {sent?<div className="login-success" role="status">Si cette adresse correspond à un compte, un courriel de réinitialisation vient d’être envoyé.</div>:
      <form onSubmit={submit}>
        <label htmlFor="email">Adresse courriel</label>
        <div className="login-input"><Mail size={17}/><input id="email" type="email" autoComplete="email" required placeholder="nom@exemple.ca" value={email} onChange={e=>setEmail(e.target.value)}/></div>
        {error&&<div className="login-error" role="alert">{error}</div>}
        <button className="login-submit" type="submit" disabled={busy}>{busy?"Envoi…":"Envoyer le lien"}</button>
      </form>}
      <p className="login-support"><Link href="/login">Retour à la connexion</Link></p>
    </div>
    <footer className="login-footer">© 2026 ConduiPRO · Québec</footer>
  </main>;
}
