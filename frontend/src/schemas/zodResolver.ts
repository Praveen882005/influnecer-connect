import type { Resolver, FieldValues, FieldError } from 'react-hook-form';
import { toNestErrors } from '@hookform/resolvers';
import type { z } from 'zod';

/**
 * Compatible Zod v4 resolver for React Hook Form.
 * Ensures compatibility between Zod 4's `error.issues` structure
 * and React Hook Form's nested error mapping without rethrowing errors.
 */
export function zodResolver<TFieldValues extends FieldValues = FieldValues>(
  schema: z.ZodType<any, any, any>
): Resolver<TFieldValues> {
  return (async (values: any, _context: any, options: any) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) {
      return {
        values: result.data,
        errors: {},
      };
    }

    const errors: Record<string, FieldError> = {};
    const issues = result.error.issues || (result.error as any).errors || [];

    for (const issue of issues) {
      const path = issue.path.join('.');
      if (!path) continue;
      if (!errors[path]) {
        errors[path] = {
          type: issue.code || 'validation',
          message: issue.message,
        };
      }
    }

    return {
      values: {},
      errors: toNestErrors(errors, options),
    };
  }) as Resolver<TFieldValues>;
}
