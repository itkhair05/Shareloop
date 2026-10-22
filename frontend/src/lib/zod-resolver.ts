import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';

/**
 * Robust, lightweight Zod resolver for React Hook Form compatible with Zod 4.
 */
export function zodResolver<T extends FieldValues>(
  schema: z.ZodType<T>
): Resolver<T> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);

    if (result.success) {
      return {
        values: result.data,
        errors: {},
      };
    }

    const errors: Record<string, { type: string; message: string }> = {};

    for (const issue of result.error.issues) {
      const fieldPath = issue.path.join('.');
      if (fieldPath && !errors[fieldPath]) {
        errors[fieldPath] = {
          type: issue.code,
          message: issue.message,
        };
      }
    }

    return {
      values: {},
      errors: errors as unknown as FieldErrors<T>,
    };
  };
}

export default zodResolver;
