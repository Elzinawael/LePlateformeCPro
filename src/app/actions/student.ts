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
  if (!student.current_phase_id) redirect("/student?notice=permit-locked");

  const { data: phase, error: phaseError } = await supabase
    .from("curriculum_phases")
    .select("phase_number")
    .eq("id", student.current_phase_id)
    .maybeSingle();

  if (phaseError || phase?.phase_number !== 2) {
    redirect("/student?notice=permit-locked");
  }

  const { data: milestoneModule, error: milestoneError } = await supabase
    .from("curriculum_modules")
    .select("id")
    .eq("phase_id", student.current_phase_id)
    .eq("module_number", 5)
    .maybeSingle();

  if (milestoneError || !milestoneModule) {
    redirect("/student?notice=permit-locked");
  }

  const { data: milestoneProgress } = await supabase
    .from("student_module_progress")
    .select("status")
    .eq("student_id", student.id)
    .eq("module_id", milestoneModule.id)
    .maybeSingle();

  if (milestoneProgress?.status !== "completed") {
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

  const path = student.school_id + "/" + student.id + "/" + randomUUID() + "." + extension;
  const { error: uploadError } = await supabase.storage
    .from("student-documents")
    .upload(path, new Uint8Array(await file.arrayBuffer()), {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) redirect("/student?notice=upload-error");

  const { error: recordError } = await supabase.from("student_licenses").insert({
    school_id: student.school_id,
    student_id: student.id,
    license_number: licenseNumber || null,
    expiry_date: expiryDate || null,
    document_path: path,
    verification_status: "pending",
  });

  if (recordError) redirect("/student?notice=permit-record-error");

  revalidatePath("/student");
  redirect("/student?notice=permit-uploaded");
}
