import { z } from 'zod';

z.setErrorMap((issue, ctx) => {
  if (
    issue.code === z.ZodIssueCode.too_small &&
    issue.type === 'string' &&
    issue.minimum === 1
  ) {
    return { message: 'This field is required.' };
  }
  return { message: ctx.defaultError };
});
