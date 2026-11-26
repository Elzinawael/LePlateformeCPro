"use client";

import { FormEvent, useState } from "react";
import { Check, Copy, Plus, School } from "lucide-react";

type CreatedSchool={
  school:{id:string;name:string;code:string;status:string};
  credentials:{email:string;password:string};
};

export default function SchoolProvisioningForm() {
  const [name,setName]=useState("");
  const [ownerFirstName,setOwnerFirstName]=useState("");
  const [ownerLastName,setOwnerLastName]=useState("");
  const [email,setEmail]=useState("");
  const [phone,setPhone]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [created,setCreated]=useState<CreatedSchool|null>(null);
  const [copied,setCopied]=useState(false);

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);setError("");setCreated(null);
    try {
      const response=await fetch("/api/platform/schools",{
        method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",
        body:JSON.stringify({name,ownerFirstName,ownerLastName,email,phone})
      });
      const result=await response.json();
      if(!response.ok) throw new Error(result.detail?result.message+" "+result.detail:result.message??"Création impossible.");
      setCreated(result as CreatedSchool);
      setName("");setOwnerFirstName("");setOwnerLastName("");setEmail("");setPhone("");
    } catch(cause) {
      setError(cause instanceof Error?cause.message:"Une erreur est survenue.");
    } finally {setBusy(false);}
  }

  async function copyCredentials() {
    if(!created)return;
    await navigator.clipboard.writeText(
      "ConduiPRO — "+created.school.name+
      "\nCode école : "+created.school.code+
      "\nConnexion : "+created.credentials.email+
      "\nMot de passe temporaire : "+created.credentials.password
    );
    setCopied(true);
    window.setTimeout(()=>setCopied(false),1800);
  }

  return <section className="students-create-panel">
    <div className="panel-head"><div><h2>Créer une école</h2><p>Un compte propriétaire unique sera créé pour cet établissement.</p></div><School size={20}/></div>
    <form onSubmit={submit} className="students-create-form">
      <label>Nom de l'école<input required maxLength={160} value={name} onChange={e=>setName(e.target.value)} placeholder="Auto-école Exemple"/></label>
      <label>Prénom du propriétaire<input required maxLength={100} value={ownerFirstName} onChange={e=>setOwnerFirstName(e.target.value)} placeholder="Prénom"/></label>
      <label>Nom du propriétaire<input required maxLength={100} value={ownerLastName} onChange={e=>setOwnerLastName(e.target.value)} placeholder="Nom"/></label>
      <label>Courriel de connexion<input required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="direction@ecole.ca"/></label>
      <label>Téléphone (facultatif)<input type="tel" maxLength={40} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="514 555-0100"/></label>
      {error&&<div className="login-error" role="alert">{error}</div>}
      <div className="students-create-submit"><button className="primary-button" type="submit" disabled={busy}><Plus size={15}/>{busy?"Création…":"Créer l'école et son accès"}</button><small>Le mot de passe temporaire est généré automatiquement et affiché une seule fois.</small></div>
    </form>
    {created&&<div className="created-credentials" role="status">
      <div><Check size={17}/><strong>École créée : {created.school.name}</strong></div>
      <p>Transmets ces identifiants au propriétaire de l'école. Il devra choisir un nouveau mot de passe à sa première connexion.</p>
      <dl><dt>Code école</dt><dd>{created.school.code}</dd><dt>Adresse de connexion</dt><dd>{created.credentials.email}</dd><dt>Mot de passe temporaire</dt><dd><code>{created.credentials.password}</code></dd></dl>
      <button type="button" className="primary-button" onClick={copyCredentials}><Copy size={15}/>{copied?"Copié":"Copier les identifiants"}</button>
    </div>}
  </section>;
}
