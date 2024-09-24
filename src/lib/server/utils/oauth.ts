import { fetchAppConfig } from '$lib/server/utils/config';
import { Issuer } from 'openid-client';

export const getOAuthProfile = async (url: string) => {
  const redirectUrl = url.split('?')[0];
  if (!redirectUrl) {
    throw new Error('Invalid redirect URL');
  }

  const client = await getOAuthClient();
  const params = client.callbackParams(url);

  const tokens = await client.callback(redirectUrl, params, {
    state: params.state,
  });
  return client.userinfo(tokens.access_token || '');
};

export const getOAuthClient = async () => {
  const config = await fetchAppConfig();
  if (!config) {
    throw new Error('OAuth is not enabled');
  }

  const { enabled, clientId, clientSecret, issuerUrl } = config;
  if (!enabled || !clientId || !clientSecret || !issuerUrl) {
    throw new Error('OAuth is not enabled');
  }

  try {
    const issuer = await Issuer.discover(issuerUrl);
    return new issuer.Client({
      client_id: clientId,
      client_secret: clientSecret,
    });
  } catch (e) {
    throw new Error('Failed to discover issuer');
  }
};
