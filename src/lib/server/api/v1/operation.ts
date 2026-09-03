import type { ZodType } from 'zod';
import type { ApiPrincipal } from './principal';
import type { ApiScope } from '$lib/api/v1/scopes';
import { requireApiScope } from './access';

export type OperationContext = {
  principal: ApiPrincipal;
  now: Date;
  requestId: string;
};
export type Operation<Input, Output> = {
  name: string;
  input: ZodType<Input>;
  output?: ZodType<Output>;
  access: {
    scopes: readonly [ApiScope, ...ApiScope[]];
    readOnly: boolean;
    destructive: boolean;
    idempotent: boolean;
  };
  execute(context: OperationContext, input: Input): Promise<Output>;
};

export const runOperation = async <Input, Output>(
  operation: Operation<Input, Output>,
  context: OperationContext,
  externalInput: unknown,
) => {
  const input = operation.input.parse(externalInput);
  let lastError: unknown;
  for (const scope of operation.access.scopes) {
    try {
      requireApiScope(context.principal, scope);
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  const output = await operation.execute(context, input);
  return operation.output ? operation.output.parse(output) : output;
};

export const operationContext = (
  principal: ApiPrincipal,
): OperationContext => ({
  principal,
  now: new Date(),
  requestId: crypto.randomUUID(),
});
