import { createHash, createHmac, randomBytes } from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';

const port = Number(process.env.E2E_OAUTH_PORT ?? '3001');
const issuer = process.env.E2E_OAUTH_ISSUER ?? `http://127.0.0.1:${port}`;
const clientId = process.env.E2E_OAUTH_CLIENT_ID ?? 'airtrail-e2e';
const clientSecret = process.env.E2E_OAUTH_CLIENT_SECRET ?? 'airtrail-e2e';

type Profile = {
  sub: string;
  preferred_username: string;
  name?: string;
};

let currentProfile: Profile = {
  sub: 'airtrail-e2e-user',
  preferred_username: 'airtrail-e2e-user',
  name: 'AirTrail E2E User',
};

const codes = new Map<string, Profile>();
const codeChallenges = new Map<string, string>();
const accessTokens = new Map<string, Profile>();

const base64url = (input: string | Buffer) =>
  Buffer.from(input).toString('base64url');

const pkceChallenge = (verifier: string) =>
  createHash('sha256').update(verifier).digest('base64url');

const signIdToken = (profile: Profile) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuer,
    aud: clientId,
    sub: profile.sub,
    preferred_username: profile.preferred_username,
    name: profile.name,
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createHmac('sha256', clientSecret)
    .update(signingInput)
    .digest('base64url');
  return `${signingInput}.${signature}`;
};

const sendJson = (response: ServerResponse, status: number, body: unknown) => {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
    'content-type': 'application/json',
  });
  response.end(payload);
};

const readBody = async (request: IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });

const readJson = async <T>(request: IncomingMessage) =>
  JSON.parse(await readBody(request)) as T;

const parseForm = async (request: IncomingMessage) => {
  const contentType = request.headers['content-type'] ?? '';
  if (Array.isArray(contentType)) return new URLSearchParams();
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return new URLSearchParams(await readBody(request));
  }
  return new URLSearchParams();
};

const hasValidClientAuth = (
  request: IncomingMessage,
  form: URLSearchParams,
) => {
  const authorization = request.headers.authorization;
  if (authorization?.toLowerCase().startsWith('basic ')) {
    const [id, secret] = Buffer.from(
      authorization.slice(authorization.indexOf(' ') + 1),
      'base64',
    )
      .toString('utf8')
      .split(':');

    return (
      decodeURIComponent(id) === clientId &&
      decodeURIComponent(secret) === clientSecret
    );
  }

  return (
    form.get('client_id') === clientId &&
    form.get('client_secret') === clientSecret
  );
};

const redirect = (response: ServerResponse, location: URL) => {
  response.writeHead(302, { location: location.toString() });
  response.end();
};

const handleRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
) => {
  const url = new URL(request.url ?? '/', issuer);

  if (url.pathname === '/.well-known/openid-configuration') {
    return sendJson(response, 200, {
      issuer,
      authorization_endpoint: `${issuer}/auth`,
      token_endpoint: `${issuer}/token`,
      userinfo_endpoint: `${issuer}/userinfo`,
      jwks_uri: `${issuer}/jwks`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      subject_types_supported: ['public'],
      scopes_supported: ['openid', 'profile'],
      claims_supported: ['sub', 'preferred_username', 'name'],
      id_token_signing_alg_values_supported: ['HS256'],
      token_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
      ],
    });
  }

  if (url.pathname === '/jwks') {
    return sendJson(response, 200, { keys: [] });
  }

  if (url.pathname === '/__test/profile' && request.method === 'POST') {
    currentProfile = await readJson<Profile>(request);
    return sendJson(response, 200, { ok: true, profile: currentProfile });
  }

  if (url.pathname === '/auth') {
    const redirectUri = url.searchParams.get('redirect_uri');
    if (!redirectUri) {
      return sendJson(response, 400, { error: 'missing redirect_uri' });
    }

    const code = randomBytes(16).toString('base64url');
    codes.set(code, currentProfile);
    const codeChallenge = url.searchParams.get('code_challenge');
    if (codeChallenge) {
      codeChallenges.set(code, codeChallenge);
    }

    const location = new URL(redirectUri);
    location.searchParams.set('code', code);
    const state = url.searchParams.get('state');
    if (state) location.searchParams.set('state', state);

    return redirect(response, location);
  }

  if (url.pathname === '/token' && request.method === 'POST') {
    const form = await parseForm(request);
    if (!hasValidClientAuth(request, form)) {
      return sendJson(response, 401, { error: 'invalid_client' });
    }

    const code = form.get('code');
    const profile = code ? codes.get(code) : undefined;
    if (!code || !profile) {
      return sendJson(response, 400, { error: 'invalid_grant' });
    }

    const codeChallenge = codeChallenges.get(code);
    if (codeChallenge) {
      const codeVerifier = form.get('code_verifier');
      if (!codeVerifier || pkceChallenge(codeVerifier) !== codeChallenge) {
        return sendJson(response, 400, { error: 'invalid_grant' });
      }
    }

    codes.delete(code);
    codeChallenges.delete(code);
    const accessToken = randomBytes(24).toString('base64url');
    accessTokens.set(accessToken, profile);
    return sendJson(response, 200, {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      id_token: signIdToken(profile),
    });
  }

  if (url.pathname === '/userinfo') {
    const authorization = request.headers.authorization;
    const token = authorization?.replace(/^Bearer\s+/i, '');
    const profile = token ? accessTokens.get(token) : undefined;
    if (!profile) return sendJson(response, 401, { error: 'invalid_token' });
    return sendJson(response, 200, profile);
  }

  return sendJson(response, 404, { error: 'not_found' });
};

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error: unknown) => {
    console.error(error);
    sendJson(response, 500, { error: 'server_error' });
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[fake-oidc] listening on ${issuer}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
