"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CarFront, Eye, EyeOff, LockKeyhole, Mail, School, UserRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { makeStudentLoginEmail } from "@/lib/auth/identifiers";

type LoginMode = "school" | "student";

export default function LoginPage() {
  const [mode,setMode]=useState<LoginMode>("school");
  const [email,setEmail]=useState("");
  const [schoolCode,setSchoolCode]=useState("");
  const [contractNumber,setContractNumber]=useState("");
  const [password,setPassword]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const supabase=createSupabaseBrowserClient();
      const identifier=mode==="school"
        ?email.trim().toLowerCase()
        :makeStudentLoginEmail(schoolCode,contractNumber);
      const {data,error:authError}=await supabase.auth.signInWithPassword({email:identifier,password});
      if(authError) throw new Error("Identifiants incorrects. Vérifiez le code école, le numéro de contrat et le mot de passe.");

      const [{data:profile,error:profileError},{data:platformAdmin,error:adminError}]=await Promise.all([
        supabase.from("profiles").select("account_type").eq("id",data.user.id).maybeSingle(),
        supabase.from("platform_admins").select("user_id").eq("user_id",data.user.id).maybeSingle()
      ]);
      if(profileError||!profile) throw new Error("Ce compte n'est pas associé à un profil ConduiPRO.");
      if(adminError) throw adminError;

      const defaultDestination=platformAdmin?"/admin":profile.account_type==="student"?"/student":"/school";
      if(data.user.app_metadata?.must_change_password===true) {
        window.location.assign("/auth/set-password?next="+encodeURIComponent(defaultDestination));
        return;
      }

      const requestedDestination=new URLSearchParams(window.location.search).get("next");
      const allowed=requestedDestination?.startsWith("/")&&!requestedDestination.startsWith("//")
        && ((profile.account_type==="student"&&requestedDestination.startsWith("/student"))
          ||(profile.account_type==="school"&&platformAdmin&&requestedDestination.startsWith("/admin"))
          ||(profile.account_type==="school"&&!requestedDestination.startsWith("/student")&&!requestedDestination.startsWith("/admin")));
      window.location.assign(allowed?requestedDestination!:defaultDestination);
    } catch(cause) {
      setError(cause instanceof Error?cause.message:"Connexion impossible. Vérifiez vos identifiants.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-shell">
    <div className="login-card">
      <div className="brand login-brand">
        <div className="brand-mark"><CarFront size={22}/></div>
        <div><strong>ConduiPRO</strong><small>GESTION AUTO-ÉCOLE</small></div>
      </div>
      <div className="login-heading">
        <h1>Bienvenue !</h1>
        <p>Choisissez votre espace pour vous connecter.</p>
      </div>

      <div className="login-mode-switch" role="group" aria-label="Type de compte">
        <button type="button" className={mode==="school"?"active":""} onClick={()=>{setMode("school");setError("");}}>
          <School size={17}/> Espace École
        </button>
        <button type="button" className={mode==="student"?"active":""} onClick={()=>{setMode("student");setError("");}}>
          <UserRound size={17}/> Espace Élève
        </button>
      </div>

      <form onSubmit={submit}>
        {mode==="school"?<>
          <label htmlFor="email">Adresse courriel de l'école</label>
          <div className="login-input"><Mail size={17} aria-hidden="true"/><input id="email" name="email" type="email" autoComplete="username" placeholder="ecole@exemple.ca" required value={email} onChange={event=>setEmail(event.target.value)}/></div>
        </>:<>
          <label htmlFor="school-code">Code de votre école</label>
          <div className="login-input"><School size={17} aria-hidden="true"/><input id="school-code" name="school_code" autoComplete="organization" placeholder="Ex. CP-A1B2C3" required maxLength={32} value={schoolCode} onChange={event=>setSchoolCode(event.target.value.toUpperCase())}/></div>
          <label htmlFor="contract-number">Numéro de contrat</label>
          <div className="login-input"><UserRound size={17} aria-hidden="true"/><input id="contract-number" name="contract_number" autoComplete="username" placeholder="Votre numéro de contrat" required maxLength={40} value={contractNumber} onChange={event=>setContractNumber(event.target.value)}/></div>
        </>}
        <label htmlFor="password">Mot de passe</label>
        <div className="login-input">
          <LockKeyhole size={17} aria-hidden="true"/>
          <input id="password" name="password" type={showPassword?"text":"password"} autoComplete="current-password" placeholder="Votre mot de passe" required value={password} onChange={event=>setPassword(event.target.value)}/>
          <button type="button" aria-label={showPassword?"Masquer le mot de passe":"Afficher le mot de passe"} onClick={()=>setShowPassword(value=>!value)}>
            {showPassword?<EyeOff size={16}/>:<Eye size={16}/>}
          </button>
        </div>
        {error&&<div className="login-error" role="alert">{error}</div>}
        <button className="login-submit" type="submit" disabled={busy}>
          {busy?"Connexion…":"Se connecter"}
        </button>
      </form>
      <p className="login-support">
        {mode==="school"?<Link href="/forgot-password">Mot de passe oublié ?</Link>:"Mot de passe oublié ? Contactez directement votre école."}<br/>
        Aucun compte ne peut être créé depuis cet écran.
      </p>
    </div>
    <footer className="login-footer">© 2026 ConduiPRO · Québec</footer>
  </main>;
}
