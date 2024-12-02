import {
  actionResult,
  setError,
  type SuperValidated,
} from 'sveltekit-superforms';

export type ErrorActionResult = {
  success: boolean;
} & (
  | { success: true; message: string }
  | { success: false; type: 'path'; path: string; message: string }
  | { success: false; type: 'error'; message: string }
  | { success: false; type: 'httpError'; status: number; message: string }
);

export const handleErrorActionResult = (
  form: SuperValidated<any>,
  result: ErrorActionResult,
) => {
  if (result.success) {
    form.message = { type: 'success', text: result.message };
    return actionResult('success', { form });
  }

  if (result.type === 'path') {
    setError(form, result.path, result.message);
    return actionResult('failure', { form });
  }

  if (result.type === 'httpError') {
    return actionResult('error', result.message, result.status);
  }

  if (result.type === 'error') {
    form.message = { type: 'error', text: result.message };
    return actionResult('failure', { form });
  }

  return actionResult('error', 'Unknown error');
};
