---
sidebar_position: 4
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

To configure OAuth authentication in AirTrail, go to the `Settings` page and click on the `OAuth` tab (you need to be an
admin to access this page).
Here you can enter the following settings:

| Setting       | Default        | Description                                                                                         |
|---------------|----------------|-----------------------------------------------------------------------------------------------------|
| Enabled       | `false`        | Whether to enable OAuth authentication.                                                             |
| Issuer URL    |                | The URL of the OIDC issuer (e.g. `https://accounts.google.com/.well-known/openid-configuration`).   |
| Client ID     |                | The client ID of the OAuth client you created in your identity provider.                            |
| Client Secret |                | The client secret of the OAuth client you created in your identity provider.                        |
| Scope         | openid profile | The scopes to send with the request.                                                                |
| Auto Register | `true`         | Whether to automatically register new users if no existing AirTrail user is found for the username. |
| Auto Login    | `false`        | Whether to automatically launch the OAuth login flow when a user visits the login page.             |