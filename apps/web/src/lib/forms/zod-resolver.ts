import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

/**
 * Connects a Zod schema to React Hook Form: validates the form values and maps each Zod issue
 * to the field it belongs to. (A minimal stand-in for @hookform/resolvers, which pulls in an
 * optional dependency chain that conflicts with Zod 4.)
 */
export function zodResolver<Schema extends z.ZodType<FieldValues, FieldValues>>(
  schema: Schema,
): Resolver<z.input<Schema>, unknown, z.output<Schema>> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }

    const errors: Record<string, unknown> = {};
    for (const issue of result.error.issues) {
      // Nested paths ("address.city") become nested objects, as React Hook Form expects.
      let target = errors;
      issue.path.forEach((segment, index) => {
        const key = String(segment);
        if (index === issue.path.length - 1) {
          target[key] ??= { type: issue.code, message: issue.message };
        } else {
          target[key] ??= {};
          target = target[key] as Record<string, unknown>;
        }
      });
    }
    return { values: {}, errors: errors as FieldErrors<z.input<Schema>> };
  };
}
