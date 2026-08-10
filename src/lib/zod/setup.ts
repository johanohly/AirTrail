import { z } from 'zod';

z.config({
  customError: (issue) => {
    if (
      issue.code === 'too_small' &&
      issue.origin === 'string' &&
      issue.minimum === 1
    ) {
      return 'This field is required.';
    }
    return undefined;
  },
});
