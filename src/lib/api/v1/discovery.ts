import {
  PROTECTED_RESOURCES,
  protectedResourceMetadataUrl,
  protectedResourceUrl,
} from './resources';
import { API_SCOPES, scopeDefinition } from './scopes';

export const MCP_DOCUMENTATION_URL =
  'https://airtrail.johan.ohly.dk/docs/api/model-context-protocol';

const AUTHENTICATION = {
  methods: ['api_key', 'oauth2_authorization_code_pkce'],
  bearerHeader: 'Authorization: Bearer <credential>',
};

export const createApiDiscovery = (instanceVersion: string) => ({
  api: {
    version: 'v1',
    minimumSupportedVersion: 'v1',
    documentation: '/api/v1/openapi.yaml',
  },
  instance: { name: 'AirTrail', version: instanceVersion },
  authentication: AUTHENTICATION,
  mcp: {
    enabled: true,
    transport: 'streamable-http',
    endpoint: PROTECTED_RESOURCES.mcp.path,
    oauth: true,
  },
  scopes: API_SCOPES.map((scope) => ({
    name: scope,
    description: scopeDefinition(scope).description,
  })),
});

/** What a plain GET on the MCP endpoint describes. */
export const createMcpDiscovery = (origin: string) => ({
  name: 'AirTrail',
  protocol: 'Model Context Protocol',
  transport: {
    type: 'streamable-http',
    endpoint: protectedResourceUrl(origin, 'mcp'),
    stateless: true,
  },
  authentication: {
    ...AUTHENTICATION,
    protectedResourceMetadata: protectedResourceMetadataUrl(origin, 'mcp'),
  },
  apiDiscovery: `${origin}/api`,
  documentation: MCP_DOCUMENTATION_URL,
});
