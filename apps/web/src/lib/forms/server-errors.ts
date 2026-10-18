import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { isApiError } from "@/lib/api/client";

/**
 * Shows API validation errors next to the matching form fields. Returns a message for the
 * form-level alert when the error is not tied to a field we display (or is not a validation error).
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  if (!isApiError(error)) return "Something went wrong. Please try again.";

  let unmatched = false;
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    if ((fields as readonly string[]).includes(field)) {
      setError(field as Path<T>, { type: "server", message: messages[0] });
    } else {
      unmatched = true;
    }
  }

  const hasFieldErrors = Object.keys(error.fieldErrors).length > 0;
  if (hasFieldErrors && !unmatched) return null;
  if (error.status === 429) return "Too many attempts. Please wait a minute and try again.";
  return hasFieldErrors ? Object.values(error.fieldErrors)[0][0] : error.message;
}
