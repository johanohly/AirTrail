import { custom, Issuer } from 'openid-client';
import { appConfig } from '$lib/server/utils/config';

custom.setHttpOptionsDefaults({
  timeout: 10000,
});

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
  const config = await appConfig.get();
  if (!config) {
    throw new Error('Failed to load config');
  }

  const { enabled, clientId, clientSecret, issuerUrl } = config.oauth;
  if (!enabled || !clientId || !clientSecret || !issuerUrl) {
    throw new Error('OAuth is not enabled');
  }

  try {
    const issuer = await Issuer.discover(issuerUrl);
    return new issuer.Client({
      client_id: clientId,
      client_secret: clientSecret,
    });
  } catch {
    throw new Error('Failed to discover issuer');
  }
};
