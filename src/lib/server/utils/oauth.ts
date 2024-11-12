import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  discovery,
  fetchUserInfo,
  randomState,
} from 'openid-client';

import { appConfig } from '$lib/server/utils/config';

export const getAuthorizeUrl = async (redirectUrl: string) => {
  const config = await appConfig.get();
  if (!config) {
    throw new Error('Failed to load config');
  }
  const scope = config.oauth.scope;

  const parameters: Record<string, string> = {
    redirect_uri: redirectUrl,
    scope,
    state: randomState(),
  };

  const client = await getOAuthClient();
  const redirectTo: URL = buildAuthorizationUrl(client, parameters);
  return redirectTo.href;
};

export const getOAuthProfile = async (currentUrl: string) => {
  let url: URL;
  try {
    url = new URL(currentUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  const client = await getOAuthClient();
  const tokens = await authorizationCodeGrant(client, url, {
    expectedState: url.searchParams.get('state') || undefined,
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

  const { enabled, clientId, clientSecret, issuerUrl } = config.oauth;
  if (!enabled || !clientId || !clientSecret || !issuerUrl) {
    throw new Error('OAuth is not enabled');
  }

  try {
    return await discovery(new URL(issuerUrl), clientId, clientSecret);
  } catch {
    throw new Error('Failed to discover issuer');
  }
};
