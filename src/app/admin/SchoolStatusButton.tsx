"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SchoolStatusButton({schoolId,status}:{schoolId:string;status:string}) {
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const router=useRouter();
 const next=status==="active"?"suspended":"active";
 async function change() {
  setBusy(true);setError("");
  try {
   const response=await fetch("/api/platform/schools/"+schoolId,{
    method:"PATCH",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({status:next})
   });
   const result=await response.json();
   if(!response.ok)throw new Error(result.message??"Modification impossible.");
   router.refresh();
  }catch(cause){setError(cause instanceof Error?cause.message:"Erreur inattendue.");}
  finally{setBusy(false);}
 }
 return <div className="school-status-actions">
  <button type="button" className="school-status-button" disabled={busy||status==="archived"} onClick={change}>
   {busy?"Mise à jour…":status==="active"?"Suspendre":"Réactiver"}
  </button>
  {error&&<small role="alert">{error}</small>}
 </div>;
}
