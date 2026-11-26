"use client";

import { useEffect,useMemo,useState } from "react";
import { CalendarClock } from "lucide-react";
import { schedulePracticalLesson } from "@/app/actions/practical";

function toLocalDateTime(value:string|null) {
  if(!value)return "";
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return "";
  return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}

export default function PracticalScheduleForm({
  progressId,scheduledAt,trainerName,notes,status
}:{
  progressId:string;scheduledAt:string|null;trainerName:string|null;notes:string|null;status:string
}) {
  const [timezoneOffset,setTimezoneOffset]=useState<number|null>(null);
  useEffect(()=>setTimezoneOffset(new Date().getTimezoneOffset()),[]);
  const defaultDate=useMemo(()=>toLocalDateTime(scheduledAt),[scheduledAt]);

  return <form action={schedulePracticalLesson} className="practical-schedule-form">
    <input type="hidden" name="progress_id" value={progressId}/>
    <input type="hidden" name="timezone_offset" value={timezoneOffset??""}/>
    <label>Date et heure (heure locale)<input name="scheduled_at" type="datetime-local" required defaultValue={defaultDate}/></label>
    <label>Nom du formateur<input name="instructor_name" required maxLength={120} defaultValue={trainerName??""} placeholder="Nom du moniteur responsable"/></label>
    <label>Observation (facultatif)<textarea name="notes" rows={2} maxLength={1000} defaultValue={notes??""} placeholder="Consignes ou remarque interne"/></label>
    <button className="primary-button practical-schedule-submit" type="submit" disabled={timezoneOffset===null}>
      <CalendarClock size={15}/>{timezoneOffset===null?"Détection du fuseau horaire…":status==="scheduled"?"Enregistrer le nouveau créneau":"Planifier la sortie"}
    </button>
  </form>;
}
