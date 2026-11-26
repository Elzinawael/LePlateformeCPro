"use client";

import { FormEvent, useState } from "react";
import { Check, Copy, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";

type CreatedStudent={
  student:{id:string;contractNumber:string;firstName:string;lastName:string;email:string|null;phase:number};
  credentials:{schoolCode:string;contractNumber:string;password:string};
};

export default function CreateStudentForm({schoolCode}:{schoolCode:string}) {
  const router=useRouter();
  const [contractNumber,setContractNumber]=useState("");
  const [firstName,setFirstName]=useState("");
  const [lastName,setLastName]=useState("");
  const [email,setEmail]=useState("");
  const [phone,setPhone]=useState("");
  const [dateOfBirth,setDateOfBirth]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [created,setCreated]=useState<CreatedStudent|null>(null);
  const [copied,setCopied]=useState(false);

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError("");setCreated(null);
    try {
      const response=await fetch("/api/school/students",{
        method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",
        body:JSON.stringify({contractNumber,firstName,lastName,email,phone,dateOfBirth})
      });
      const result=await response.json();
      if(!response.ok) throw new Error(result.detail?result.message+" "+result.detail:result.message??"Création impossible.");
      setCreated(result as CreatedStudent);
      setContractNumber("");setFirstName("");setLastName("");setEmail("");setPhone("");setDateOfBirth("");
      router.refresh();
    } catch(cause) {
      setError(cause instanceof Error?cause.message:"Une erreur est survenue.");
    } finally {setBusy(false);}
  }

  async function copyCredentials() {
    if(!created)return;
    await navigator.clipboard.writeText(
      "ConduiPRO — "+created.student.firstName+" "+created.student.lastName+
      "\nCode école : "+created.credentials.schoolCode+
      "\nNuméro de contrat / identifiant : "+created.credentials.contractNumber+
      "\nMot de passe initial : "+created.credentials.password
    );
    setCopied(true);window.setTimeout(()=>setCopied(false),1800);
  }

  return <>
    <section className="students-create-panel">
      <div className="panel-head"><div><h2>Créer un élève et son accès</h2><p>Le dossier, le compte de connexion et le suivi pédagogique sont créés ensemble.</p></div><UserPlus size={19}/></div>
      <div className="student-school-code"><span>Code de connexion de votre école</span><strong>{schoolCode}</strong><small>L'élève devra saisir ce code, son numéro de contrat et son mot de passe pour se connecter.</small></div>
      <form onSubmit={submit} className="students-create-form">
        <label>Numéro de contrat<input name="contract_number" required maxLength={40} value={contractNumber} onChange={e=>setContractNumber(e.target.value)} placeholder="Ex. CP-2026-0184"/></label>
        <label>Prénom<input name="first_name" required maxLength={100} value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="Prénom"/></label>
        <label>Nom<input name="last_name" required maxLength={100} value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Nom"/></label>
        <label>Courriel (facultatif)<input name="email" type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="eleve@exemple.ca"/></label>
        <label>Téléphone (facultatif)<input name="phone" type="tel" maxLength={40} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="514 555-0100"/></label>
        <label>Date de naissance (facultatif)<input name="date_of_birth" type="date" value={dateOfBirth} onChange={e=>setDateOfBirth(e.target.value)}/></label>
        {error&&<div className="login-error" role="alert">{error}</div>}
        <div className="students-create-submit"><button className="primary-button" type="submit" disabled={busy}><UserPlus size={15}/>{busy?"Création du dossier et du compte…":"Créer l'élève et ses identifiants"}</button><small>Le mot de passe suit la règle du cahier de cadrage et devra être changé dès la première connexion.</small></div>
      </form>
    </section>
    {created&&<section className="created-credentials" role="status">
      <div><Check size={17}/><strong>Compte élève créé : {created.student.firstName} {created.student.lastName}</strong></div>
      <p>Remets ces identifiants à l'élève par un canal sécurisé. Le mot de passe ne sera plus affiché après avoir quitté cet écran.</p>
      <dl><dt>Code école</dt><dd>{created.credentials.schoolCode}</dd><dt>Identifiant (numéro de contrat)</dt><dd>{created.credentials.contractNumber}</dd><dt>Mot de passe initial</dt><dd><code>{created.credentials.password}</code></dd></dl>
      <button type="button" className="primary-button" onClick={copyCredentials}><Copy size={15}/>{copied?"Identifiants copiés":"Copier les identifiants"}</button>
    </section>}
  </>;
}
