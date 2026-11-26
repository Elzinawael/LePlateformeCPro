"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CarFront, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const searchParams=useSearchParams();
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [busy,setBusy]=useState(false);
  const [checking,setChecking]=useState(true);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  useEffect(()=>{
    let active=true;
    const supabase=createSupabaseBrowserClient();
    supabase.auth.getUser().then(({data,error:authError})=>{
      if(!active) return;
      if(authError||!data.user) setError("Le lien est expiré ou invalide. Demandez une nouvelle invitation ou réinitialisation.");
      setChecking(false);
    });
    return ()=>{active=false;};
  },[]);

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if(password.length<10) {
      setError("Utilisez au moins 10 caractères.");
      return;
    }
    if(password!==confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      const supabase=createSupabaseBrowserClient();
      const {error:updateError}=await supabase.auth.updateUser({password});
      if(updateError) throw updateError;
      const {data:{user},error:userError}=await supabase.auth.getUser();
      if(userError||!user) throw new Error("La session n’est plus valide. Recommencez depuis votre courriel.");
      const {data:profile,error:profileError}=await supabase.from("profiles")
        .select("account_type").eq("id",user.id).maybeSingle();
      if(profileError) throw profileError;
      const fallback=profile?.account_type==="school"?"/school":"/student";
      const next=searchParams.get("next");
      const destination=next?.startsWith("/")&&!next.startsWith("//")?next:fallback;
      setMessage("Mot de passe enregistré. Ouverture de votre espace…");
      window.location.assign(destination);
    } catch(cause) {
      setError(cause instanceof Error?cause.message:"Impossible de modifier le mot de passe.");
      setBusy(false);
    }
  }

  return <main className="login-shell">
    <div className="login-card">
      <div className="brand login-brand"><div className="brand-mark"><CarFront size={22}/></div><div><strong>ConduiPRO</strong><small>GESTION AUTO-ÉCOLE</small></div></div>
      <div className="login-heading"><h1>Créer votre mot de passe</h1><p>Choisissez un mot de passe personnel pour sécuriser votre compte.</p></div>
      {checking?<p className="login-support">Vérification de votre lien sécurisé…</p>:
      <form onSubmit={submit}>
        <label htmlFor="password">Nouveau mot de passe</label>
        <div className="login-input"><LockKeyhole size={17}/><input id="password" type={showPassword?"text":"password"} autoComplete="new-password" minLength={10} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="10 caractères minimum"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Masquer le mot de passe":"Afficher le mot de passe"}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div>
        <label htmlFor="confirm-password">Confirmer le mot de passe</label>
        <div className="login-input"><LockKeyhole size={17}/><input id="confirm-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Confirmer le mot de passe"/></div>
        {error&&<div className="login-error" role="alert">{error}</div>}
        {message&&<div className="login-success" role="status">{message}</div>}
        <button className="login-submit" type="submit" disabled={busy||!!error}>{busy?"Enregistrement…":"Enregistrer le mot de passe"}</button>
      </form>}
    </div>
    <footer className="login-footer">© 2026 ConduiPRO · Québec</footer>
  </main>;
}
