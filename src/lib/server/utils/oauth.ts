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
import { appConfig } from '$lib/server/utils/config';

export const OAUTH_STATE_COOKIE = 'airtrail_oauth_state';
export const OAUTH_CODE_VERIFIER_COOKIE = 'airtrail_oauth_code_verifier';

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

  return await fetchUserInfo(client, tokens.access_token, claims.sub);
};

export const getOAuthClient = async () => {
  const config = await appConfig.get();
  if (!config) {
    throw new Error('Failed to load config');
  }

  const {
    enabled,
    clientId,
    clientSecret,
    issuerUrl,
    tokenEndpointAuthMethod,
  } = config.oauth;
  if (!enabled || !clientId || !clientSecret || !issuerUrl) {
    throw new Error('OAuth is not enabled or configured properly');
  }

  try {
    return await discovery(
      new URL(issuerUrl),
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
    throw new Error('Failed to discover issuer');
  }
};
