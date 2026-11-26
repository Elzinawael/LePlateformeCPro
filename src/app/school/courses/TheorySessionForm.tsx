"use client";

import { useEffect,useState } from "react";
import { createTheorySession } from "@/app/actions/courses";

type ModuleOption={id:string;module_number:number;name:string;phase_number:number};

export function TheorySessionForm({modules}:{modules:ModuleOption[]}) {
  const [timezoneOffset,setTimezoneOffset]=useState<number|null>(null);
  useEffect(()=>setTimezoneOffset(new Date().getTimezoneOffset()),[]);
  return <form action={createTheorySession} className="theory-create-form">
    <input type="hidden" name="timezone_offset" value={timezoneOffset}/>
    <label>Module du programme
      <select name="module_id" required defaultValue="">
        <option value="" disabled>Choisir un module</option>
        {modules.map(m=><option key={m.id} value={m.id}>Phase {m.phase_number} · Module {m.module_number} — {m.name}</option>)}
      </select>
    </label>
    <label>Titre de la séance (facultatif)
      <input name="title" maxLength={120} placeholder="Ex. : Module 1 — Groupe du soir"/>
    </label>
    <div className="theory-datetime-grid">
      <label>Début
        <input name="start_at" type="datetime-local" required/>
      </label>
      <label>Fin
        <input name="end_at" type="datetime-local" required/>
      </label>
    </div>
    <div className="theory-datetime-grid">
      <label>Capacité maximale
        <input name="capacity" type="number" min={1} max={50} defaultValue={12} required/>
      </label>
      <label>Lieu (facultatif)
        <input name="location" maxLength={200} placeholder="Adresse ou salle"/>
      </label>
    </div>
    <small>La date et l’heure sont interprétées dans le fuseau horaire de votre navigateur. Durée autorisée : 30 minutes à 6 heures.</small>
    <button className="primary-button" type="submit" disabled={timezoneOffset===null}>{timezoneOffset===null?"Détection du fuseau horaire…":"Créer la séance"}</button>
  </form>;
}
