---
sidebar_position: 5
---

# OAuth Authentication

AirTrail supports authentication via OpenID Connect (OIDC).
This allows you to use your existing identity provider to authenticate users in AirTrail.

## Prerequisites

Before you can configure OAuth authentication in AirTrail, you need to set up an OAuth client in your identity provider.
The specific steps to do this depend on the identity provider you are using, but in general you will need to:

1. Register a new OIDC/OAuth2 client in your identity provider.
2. Configure the client with the following settings:
   - Client type: `Confidential`
   - Application type: `Web application`
   - Grant type: `Authorization Code`
3. Add the following redirect URI to the client configuration:
   - `http://DOMAIN:PORT/login`

## Configuration

To configure OAuth authentication in AirTrail, either go to the `Settings` page and click on the `OAuth` tab (you need
to be an
admin to access this page), or configure OAuth through the `.env` file.

The same settings are available in both the `.env` file and the settings page.
On startup, AirTrail will check the `.env` file for OAuth settings and use them if they are present.
Settings that are configured in the `.env` file will not be editable in the settings page.

| Setting       | Env. Var. Name        | Default                                                                  | Description                                                                                                                                                   |
| ------------- | --------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enabled       | `OAUTH_ENABLED`       | `false`                                                                  | Whether to enable OAuth authentication.                                                                                                                       |
| Issuer URL    | `OAUTH_ISSUER_URL`    |                                                                          | The URL of the OIDC issuer (e.g. `https://accounts.google.com/.well-known/openid-configuration`).                                                             |
| Client ID     | `OAUTH_CLIENT_ID`     | The client ID of the OAuth client you created in your identity provider. |
| Client Secret | `OAUTH_CLIENT_SECRET` |                                                                          | The client secret of the OAuth client you created in your identity provider.                                                                                  |
| Scope         | `OAUTH_SCOPE`         | openid profile                                                           | The scopes to send with the request.                                                                                                                          |
| Auto Register | `OAUTH_AUTO_REGISTER` | `true`                                                                   | Whether to automatically register new users if no existing AirTrail user is found for the username.                                                           |
| Auto Login    | `OAUTH_AUTO_LOGIN`    | `false`                                                                  | Whether to automatically launch the OAuth login flow when a user visits the login page. To prevent redirection, add `?autoLogin=false` to the end of the url. |
