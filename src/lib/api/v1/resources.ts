import { MCP_DEFAULT_SCOPES } from './scopes';

export type ProtectedResource = {
  /** Path that identifies the resource and scopes a credential to it. */
  path: string;
  /** Scopes to request when the client asked for none (MCP only). */
  defaultScopes: readonly string[];
};

/** The protected resources an OAuth credential can address. */
export const PROTECTED_RESOURCES = {
  apiV1: { path: '/api/v1', defaultScopes: [] },
  mcp: { path: '/api/mcp', defaultScopes: MCP_DEFAULT_SCOPES },
} as const satisfies Record<string, ProtectedResource>;

export type ProtectedResourceKey = keyof typeof PROTECTED_RESOURCES;

export const protectedResourceUrl = (
  origin: string,
  key: ProtectedResourceKey,
) => `${origin}${PROTECTED_RESOURCES[key].path}`;

export const protectedResourceMetadataUrl = (
  origin: string,
  key: ProtectedResourceKey,
) =>
  `${origin}/.well-known/oauth-protected-resource${PROTECTED_RESOURCES[key].path}`;

/** The resource a `resource` parameter names, or null when it names none of ours. */
export const protectedResourceKey = (
  origin: string,
  resource: string,
): ProtectedResourceKey | null =>
  (Object.keys(PROTECTED_RESOURCES) as ProtectedResourceKey[]).find(
    (key) => protectedResourceUrl(origin, key) === resource,
  ) ?? null;
