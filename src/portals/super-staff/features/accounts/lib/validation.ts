import type { NewAccountInput } from "../types";

export type FieldErrors = Partial<
  Record<
    | "fullName"
    | "email"
    | "modules"
    | "supervisor"
    | "departmentCode"
    | "phone"
    | "employeeId",
    string
  >
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate a create/edit payload. `existingEmails` holds emails already used by
 * *other* accounts (for uniqueness). Returns a field→message map; empty = valid.
 */
export function validateAccount(
  input: NewAccountInput,
  existingEmails: string[],
): FieldErrors {
  const errors: FieldErrors = {};

  if (!input.fullName.trim()) {
    errors.fullName = "Full name is required.";
  }

  const email = input.email.trim().toLowerCase();
  if (!input.email.trim()) {
    errors.email = "Email is required.";
  } else if (!EMAIL_RE.test(input.email.trim())) {
    errors.email = "Enter a valid email address.";
  } else if (existingEmails.some((e) => e.toLowerCase() === email)) {
    errors.email = "That email is already in use.";
  }

  if (input.role === "Staff") {
    if (input.modules.length === 0) {
      errors.modules = "Assign at least one module.";
    }
    if (input.isSupervisor && !input.modules.includes("Incidents")) {
      errors.supervisor = "Supervisor requires the Incidents module.";
    }
  }

  // The database rejects a responder missing any of these, but only AFTER the
  // auth user has been created — the Edge Function then has to delete it and
  // the invite email has already gone out. Catch it here first.
  if (input.role === "Responder") {
    if (!input.departmentCode?.trim()) {
      errors.departmentCode = "Choose a department.";
    }
    if (!input.phone?.trim()) {
      errors.phone = "A phone number is required for responders.";
    }
    if (!input.employeeId?.trim()) {
      errors.employeeId = "An employee ID is required for responders.";
    }
  }

  return errors;
}
