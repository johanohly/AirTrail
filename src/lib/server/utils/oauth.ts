import {
  allowInsecureRequests,
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  ClientSecretBasic,
  ClientSecretPost,
  discovery,
  fetchUserInfo,
  randomPKCECodeVerifier,
  randomState,
} from 'openid-client';

import { env } from '$env/dynamic/private';
import { appConfig, type FullAppConfig } from '$lib/server/utils/config';

export const OAUTH_STATE_COOKIE = 'airtrail_oauth_state';
export const OAUTH_CODE_VERIFIER_COOKIE = 'airtrail_oauth_code_verifier';

type OAuthDiscoveryConfig = Pick<
  FullAppConfig['oauth'],
  'issuerUrl' | 'clientId' | 'clientSecret' | 'tokenEndpointAuthMethod'
>;

export class OAuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthConfigurationError';
  }
}

export const discoverOAuthClient = async (config: OAuthDiscoveryConfig) => {
  const { clientId, clientSecret, issuerUrl, tokenEndpointAuthMethod } = config;
  if (!clientId || !clientSecret || !issuerUrl) {
    throw new OAuthConfigurationError(
      'Enter an issuer URL, client ID, and client secret first.',
    );
  }

  let issuer: URL;
  try {
    issuer = new URL(issuerUrl);
  } catch {
    throw new OAuthConfigurationError('Enter a valid issuer URL.');
  }

  try {
    return await discovery(
      issuer,
      clientId,
      clientSecret,
      tokenEndpointAuthMethod === 'client_secret_basic'
        ? ClientSecretBasic(clientSecret)
        : ClientSecretPost(clientSecret),
      env.OAUTH_ALLOW_INSECURE_HTTP === 'true'
        ? { execute: [allowInsecureRequests] }
        : undefined,
    );
  } catch {
    throw new OAuthConfigurationError(
      'Could not load a valid OIDC discovery document from this issuer URL.',
    );
  }
};

export const getAuthorizeUrl = async (redirectUrl: string) => {
  const config = await appConfig.get();
  if (!config) {
    throw new Error('Failed to load config');
  }
  const { prompt, scope } = config.oauth;
  const state = randomState();
  const codeVerifier = randomPKCECodeVerifier();
  const client = await getOAuthClient();

  const parameters: Record<string, string> = {
    redirect_uri: redirectUrl,
    scope,
    state,
  };

  if (prompt) {
    parameters.prompt = prompt;
  }

  if (client.serverMetadata().supportsPKCE()) {
    parameters.code_challenge = await calculatePKCECodeChallenge(codeVerifier);
    parameters.code_challenge_method = 'S256';
  }

  const redirectTo: URL = buildAuthorizationUrl(client, parameters);
  return { codeVerifier, state, url: redirectTo.href };
};

export const getOAuthProfile = async (
  currentUrl: string,
  expectedState: string,
  codeVerifier: string,
) => {
  let url: URL;
  try {
    url = new URL(currentUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  const client = await getOAuthClient();
  const pkceCodeVerifier = client.serverMetadata().supportsPKCE()
    ? codeVerifier
    : undefined;
  const tokens = await authorizationCodeGrant(client, url, {
    expectedState,
    pkceCodeVerifier,
  });
  const claims = tokens.claims();
  if (!claims) {
    throw new Error('Failed to get user info');
  }

  return {
    profile: await fetchUserInfo(client, tokens.access_token, claims.sub),
    idTokenClaims: { ...claims } as Record<string, unknown>,
  };
};

export const getOAuthClient = async () => {
  const config = await appConfig.get();
  if (!config) {
    throw new Error('Failed to load config');
  }

  if (!config.oauth.enabled) {
    throw new Error('OAuth is not enabled or configured properly');
  }
  return discoverOAuthClient(config.oauth);
};
