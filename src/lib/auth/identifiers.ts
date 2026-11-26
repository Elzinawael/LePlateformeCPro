export function makeStudentLoginEmail(schoolCode: string, contractNumber: string): string {
  const school = schoolCode.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const contract = contractNumber.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  if (!school || !contract) throw new Error("Code d'école et numéro de contrat requis.");
  return `student.${school}.${contract}@login.conduipro.app`;
}

export function makeInitialStudentPassword(contractNumber: string): string {
  const contract = contractNumber.trim();
  if (!contract) throw new Error("Numéro de contrat requis.");
  return `${contract}@${[...contract].reverse().join("")}`;
}
