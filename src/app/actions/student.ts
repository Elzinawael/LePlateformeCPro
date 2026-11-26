"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type StudentContext = {
  id: string;
  school_id: string;
  current_phase_id: string | null;
};

async function requireStudent(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<StudentContext | null> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.account_type !== "student") return null;

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id,school_id,current_phase_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (studentError || !student) return null;
  return student;
}

export async function createCourseRequest(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const student = await requireStudent(supabase);

  if (!student) redirect("/login?error=student-access");

  const requestType = String(formData.get("request_type") ?? "");
  const moduleId = String(formData.get("module_id") ?? "").trim();
  const preferredCourseId = String(formData.get("preferred_course_id") ?? "").trim();
  const availabilityText = String(formData.get("availability_text") ?? "").trim();

  if (!student.current_phase_id) redirect("/student?notice=phase-missing");

  if (requestType === "theory") {
    if (!moduleId) redirect("/student?notice=request-invalid");

    const { data: module, error: moduleError } = await supabase
      .from("curriculum_modules")
      .select("id,phase_id,is_active")
      .eq("id", moduleId)
      .maybeSingle();

    if (moduleError || !module || module.phase_id !== student.current_phase_id || !module.is_active) {
      redirect("/student?notice=module-unavailable");
    }

    const { data: progress } = await supabase
      .from("student_module_progress")
      .select("status")
      .eq("student_id", student.id)
      .eq("module_id", moduleId)
      .maybeSingle();

    if (progress?.status === "completed") {
      redirect("/student?notice=module-completed");
    }

    let courseId: string | null = null;
    if (preferredCourseId) {
      const { data: course, error: courseError } = await supabase
        .from("theory_courses")
        .select("id")
        .eq("id", preferredCourseId)
        .eq("school_id", student.school_id)
        .eq("module_id", moduleId)
        .eq("status", "scheduled")
        .maybeSingle();

      if (courseError || !course) redirect("/student?notice=session-unavailable");
      courseId = course.id;
    }

    const { error } = await supabase.from("course_requests").insert({
      school_id: student.school_id,
      student_id: student.id,
      request_type: "theory",
      module_id: moduleId,
      preferred_course_id: courseId,
      status: "submitted",
    });

    if (error) redirect("/student?notice=request-error");
  } else if (requestType === "practical") {
    if (!availabilityText || availabilityText.length > 500) {
      redirect("/student?notice=availability-invalid");
    }

    const { error } = await supabase.from("course_requests").insert({
      school_id: student.school_id,
      student_id: student.id,
      request_type: "practical",
      availability_text: availabilityText,
      status: "submitted",
    });

    if (error) redirect("/student?notice=request-error");
  } else {
    redirect("/student?notice=request-invalid");
  }

  revalidatePath("/student");
  redirect("/student?notice=request-sent");
}

export async function uploadLearnerPermit(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const student = await requireStudent(supabase);

  if (!student) redirect("/login?error=student-access");

  const { data: schoolPhaseOne, error: schoolPhaseError } = await supabase
    .from("curriculum_phases")
    .select("id")
    .eq("school_id", student.school_id)
    .eq("phase_number", 1)
    .maybeSingle();
  if (schoolPhaseError) redirect("/student?notice=permit-locked");

  const { data: globalPhaseOne, error: globalPhaseError } = schoolPhaseOne
    ? { data: null, error: null }
    : await supabase
        .from("curriculum_phases")
        .select("id")
        .is("school_id", null)
        .eq("phase_number", 1)
        .maybeSingle();
  if (globalPhaseError) redirect("/student?notice=permit-locked");

  const phaseOneId = schoolPhaseOne?.id ?? globalPhaseOne?.id;
  if (!phaseOneId) redirect("/student?notice=permit-locked");

  const { data: phaseOneModules, error: modulesError } = await supabase
    .from("curriculum_modules")
    .select("id,module_number")
    .eq("phase_id", phaseOneId)
    .gte("module_number", 1)
    .lte("module_number", 5);
  if (modulesError || !phaseOneModules || phaseOneModules.length !== 5) {
    redirect("/student?notice=permit-locked");
  }

  const { data: completedRows, error: progressError } = await supabase
    .from("student_module_progress")
    .select("module_id,status")
    .eq("student_id", student.id)
    .eq("school_id", student.school_id)
    .in("module_id", phaseOneModules.map((module) => module.id))
    .eq("status", "completed");
  if (progressError || completedRows?.length !== 5) {
    redirect("/student?notice=permit-locked");
  }

  const file = formData.get("permit_file");
  if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024) {
    redirect("/student?notice=file-invalid");
  }

  const acceptedTypes: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
  };
  const extension = acceptedTypes[file.type];
  if (!extension) redirect("/student?notice=file-type");

  const licenseNumber = String(formData.get("license_number") ?? "").trim();
  const expiryDate = String(formData.get("expiry_date") ?? "").trim();
  if (licenseNumber.length > 64) redirect("/student?notice=permit-details-invalid");
  if (expiryDate && (!/^\\d{4}-\\d{2}-\\d{2}$/.test(expiryDate)
    || Number.isNaN(Date.parse(expiryDate + "T00:00:00Z")))) {
    redirect("/student?notice=permit-details-invalid");
  }

  const { data: pendingLicense, error: pendingError } = await supabase
    .from("student_licenses")
    .select("id")
    .eq("student_id", student.id)
    .eq("verification_status", "pending")
    .limit(1)
    .maybeSingle();
  if (pendingError) redirect("/student?notice=permit-record-error");
  if (pendingLicense) redirect("/student?notice=permit-pending");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPdf = bytes.length >= 5
    && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44
    && bytes[3] === 0x46 && bytes[4] === 0x2d;
  const isJpeg = bytes.length >= 3
    && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e
    && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a
    && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (
    (file.type === "application/pdf" && !isPdf)
    || (file.type === "image/jpeg" && !isJpeg)
    || (file.type === "image/png" && !isPng)
  ) {
    redirect("/student?notice=file-type");
  }

  const path = student.school_id + "/" + student.id + "/" + randomUUID() + "." + extension;
  const { error: uploadError } = await supabase.storage
    .from("student-documents")
    .upload(path, bytes, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) redirect("/student?notice=upload-error");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    await supabase.storage.from("student-documents").remove([path]);
    redirect("/login");
  }

  const { error: documentError } = await supabase.from("student_documents").insert({
    school_id: student.school_id,
    student_id: student.id,
    document_type: "learner_permit",
    file_name: "permis-apprenti." + extension,
    storage_path: path,
    mime_type: file.type,
    file_size: file.size,
    status: "pending",
    uploaded_by: user.id,
  });

  if (documentError) {
    await supabase.storage.from("student-documents").remove([path]);
    redirect("/student?notice=permit-record-error");
  }

  const { error: licenseError } = await supabase.from("student_licenses").insert({
    school_id: student.school_id,
    student_id: student.id,
    license_number: licenseNumber || null,
    expiry_date: expiryDate || null,
    document_path: path,
    verification_status: "pending",
  });

  if (licenseError) {
    await supabase.from("student_documents").delete()
      .eq("student_id", student.id).eq("storage_path", path);
    await supabase.storage.from("student-documents").remove([path]);
    redirect("/student?notice=permit-record-error");
  }

  revalidatePath("/student");
  redirect("/student?notice=permit-uploaded");
}
