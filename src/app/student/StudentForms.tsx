"use client";

import { createCourseRequest, uploadLearnerPermit } from "@/app/actions/student";

type TheoryRequestProps = {
  moduleId: string;
  courseId: string;
  label: string;
};

export function TheoryRequestButton({ moduleId, courseId, label }: TheoryRequestProps) {
  return (
    <form action={createCourseRequest}>
      <input type="hidden" name="request_type" value="theory" />
      <input type="hidden" name="module_id" value={moduleId} />
      <input type="hidden" name="preferred_course_id" value={courseId} />
      <button className="student-action" type="submit">
        {label}
      </button>
    </form>
  );
}

export function PracticalRequestForm() {
  return (
    <form action={createCourseRequest} className="student-request-form">
      <input type="hidden" name="request_type" value="practical" />
      <label htmlFor="availability_text">Vos disponibilités</label>
      <textarea
        id="availability_text"
        name="availability_text"
        rows={4}
        maxLength={500}
        required
        placeholder="Ex. : disponible les mardis et jeudis après 16 h, ou le samedi matin."
      />
      <button className="student-action" type="submit">Envoyer ma demande</button>
    </form>
  );
}

export function PermitUploadForm() {
  return (
    <form action={uploadLearnerPermit} className="student-request-form">
      <label htmlFor="license_number">Numéro de permis (facultatif)</label>
      <input id="license_number" name="license_number" maxLength={64} />
      <label htmlFor="expiry_date">Date d&apos;expiration (facultatif)</label>
      <input id="expiry_date" name="expiry_date" type="date" />
      <label htmlFor="permit_file">Copie du permis d&apos;apprenti conducteur</label>
      <input
        id="permit_file"
        name="permit_file"
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        required
      />
      <small>PDF, JPG ou PNG · Maximum 10 Mo · Fichier privé</small>
      <button className="student-action" type="submit">Téléverser mon permis</button>
    </form>
  );
}
