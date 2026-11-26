"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireSchoolOwner() {
  const supabase=await createSupabaseServerClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)redirect("/login");
  const {data:profile,error:profileError}=await supabase.from("profiles").select("account_type").eq("id",user.id).maybeSingle();
  if(profileError||profile?.account_type!=="school")redirect("/login?error=school-access");
  const {data:membership,error:membershipError}=await supabase.from("school_members")
    .select("school_id,role").eq("user_id",user.id).eq("status","active").eq("role","owner").maybeSingle();
  if(membershipError||!membership)redirect("/login?error=school-access");
  return {supabase,user,schoolId:membership.school_id};
}

function cleanText(value:FormDataEntryValue|null,max:number) {
  return typeof value==="string"?value.trim().slice(0,max):"";
}

export async function updateStudentDetails(formData:FormData):Promise<void> {
  const {supabase,schoolId}=await requireSchoolOwner();
  const studentId=cleanText(formData.get("student_id"),64);
  const firstName=cleanText(formData.get("first_name"),100);
  const lastName=cleanText(formData.get("last_name"),100);
  const email=cleanText(formData.get("email"),254).toLowerCase();
  const phone=cleanText(formData.get("phone"),40);
  const dateOfBirth=cleanText(formData.get("date_of_birth"),10);

  if(!studentId||!firstName||!lastName
    ||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ||(dateOfBirth&&!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth))) {
    redirect("/school/students/"+studentId+"?notice=details-invalid");
  }

  const {data,error}=await supabase.from("students").update({
    first_name:firstName,last_name:lastName,email:email||null,phone:phone||null,date_of_birth:dateOfBirth||null
  }).eq("id",studentId).eq("school_id",schoolId).select("id").maybeSingle();
  if(error||!data)redirect("/school/students/"+studentId+"?notice=details-error");

  revalidatePath("/school/students");
  revalidatePath("/school/students/"+studentId);
  revalidatePath("/student");
  redirect("/school/students/"+studentId+"?notice=details-saved");
}

export async function saveStudentContract(formData:FormData):Promise<void> {
  const {supabase,schoolId}=await requireSchoolOwner();
  const studentId=cleanText(formData.get("student_id"),64);
  const contractDate=cleanText(formData.get("contract_date"),10);
  const dueDate=cleanText(formData.get("due_date"),10);
  const amountText=cleanText(formData.get("contract_amount"),32);
  const amount=Number(amountText.replace(",","."));

  if(!studentId||!Number.isFinite(amount)||amount<=0||amount>1000000
    ||(contractDate&&!/^\d{4}-\d{2}-\d{2}$/.test(contractDate))
    ||(dueDate&&!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))
    ||(dueDate&&contractDate&&dueDate<contractDate)) {
    redirect("/school/students/"+studentId+"?notice=contract-invalid");
  }

  const {data:student,error:studentError}=await supabase.from("students")
    .select("id").eq("id",studentId).eq("school_id",schoolId).maybeSingle();
  if(studentError||!student)redirect("/school/students?notice=student-not-found");

  const {error}=await supabase.rpc("save_student_contract",{
    p_student_id:studentId,
    p_contract_date:contractDate||null,
    p_contract_amount:amount,
    p_due_date:dueDate||null
  });
  if(error) {
    const message=error.message.toLowerCase();
    if(message.includes("payments already recorded"))redirect("/school/students/"+studentId+"?notice=contract-paid-conflict");
    redirect("/school/students/"+studentId+"?notice=contract-error");
  }

  revalidatePath("/school");
  revalidatePath("/school/students/"+studentId);
  revalidatePath("/student");
  redirect("/school/students/"+studentId+"?notice=contract-saved");
}

export async function recordStudentPayment(formData:FormData):Promise<void> {
  const {supabase,schoolId}=await requireSchoolOwner();
  const studentId=cleanText(formData.get("student_id"),64);
  const invoiceId=cleanText(formData.get("invoice_id"),64);
  const amountText=cleanText(formData.get("amount"),32);
  const amount=Number(amountText.replace(",","."));
  const method=cleanText(formData.get("payment_method"),20);
  const paymentDate=cleanText(formData.get("payment_date"),10);
  const reference=cleanText(formData.get("reference"),120);
  const notes=cleanText(formData.get("notes"),1000);

  if(!studentId||!invoiceId||!Number.isFinite(amount)||amount<=0||amount>1000000
    ||!["cash","debit","credit","transfer","other"].includes(method)
    ||(paymentDate&&!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate))) {
    redirect("/school/students/"+studentId+"?notice=payment-invalid");
  }

  const {data:invoice,error:invoiceError}=await supabase.from("invoices")
    .select("id").eq("id",invoiceId).eq("student_id",studentId).eq("school_id",schoolId).maybeSingle();
  if(invoiceError||!invoice)redirect("/school/students/"+studentId+"?notice=invoice-not-found");

  const {error}=await supabase.rpc("record_student_payment",{
    p_invoice_id:invoiceId,
    p_amount:amount,
    p_payment_method:method,
    p_payment_date:paymentDate||new Date().toISOString().slice(0,10),
    p_reference:reference||null,
    p_notes:notes||null
  });
  if(error) {
    const message=error.message.toLowerCase();
    if(message.includes("exceeds the remaining"))redirect("/school/students/"+studentId+"?notice=payment-too-large");
    redirect("/school/students/"+studentId+"?notice=payment-error");
  }

  revalidatePath("/school");
  revalidatePath("/school/students/"+studentId);
  revalidatePath("/student");
  redirect("/school/students/"+studentId+"?notice=payment-saved");
}

export async function uploadStudentContract(formData:FormData):Promise<void> {
  const {supabase,schoolId}=await requireSchoolOwner();
  const studentId=cleanText(formData.get("student_id"),64);
  const file=formData.get("contract_file");
  if(!studentId||!(file instanceof File)||file.size===0||file.size>10*1024*1024) {
    redirect("/school/students/"+studentId+"?notice=contract-file-invalid");
  }
  if(file.type!=="application/pdf")redirect("/school/students/"+studentId+"?notice=contract-file-type");

  const {data:student,error:studentError}=await supabase.from("students").select("id")
    .eq("id",studentId).eq("school_id",schoolId).maybeSingle();
  if(studentError||!student)redirect("/school/students?notice=student-not-found");

  const {data:contract,error:contractError}=await supabase.from("student_contracts")
    .select("id,contract_file_path").eq("student_id",studentId).eq("school_id",schoolId).eq("status","active")
    .order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(contractError||!contract)redirect("/school/students/"+studentId+"?notice=contract-required");

  const bytes=new Uint8Array(await file.arrayBuffer());
  const isPdf=bytes.length>=5&&bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46&&bytes[4]===0x2d;
  if(!isPdf)redirect("/school/students/"+studentId+"?notice=contract-file-type");

  const path=schoolId+"/"+studentId+"/contract-"+randomUUID()+".pdf";
  const {error:uploadError}=await supabase.storage.from("student-documents").upload(path,bytes,{
    contentType:"application/pdf",cacheControl:"3600",upsert:false
  });
  if(uploadError)redirect("/school/students/"+studentId+"?notice=contract-upload-error");

  const {error:updateError}=await supabase.from("student_contracts").update({contract_file_path:path})
    .eq("id",contract.id).eq("school_id",schoolId);
  if(updateError) {
    await supabase.storage.from("student-documents").remove([path]);
    redirect("/school/students/"+studentId+"?notice=contract-upload-error");
  }
  if(contract.contract_file_path)await supabase.storage.from("student-documents").remove([contract.contract_file_path]);

  revalidatePath("/school/students/"+studentId);
  revalidatePath("/student");
  redirect("/school/students/"+studentId+"?notice=contract-file-saved");
}
