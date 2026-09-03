import { authenticateApiPrincipal } from './principal';

export const authenticateRestPrincipal = (event: {
  request: Request;
  url: URL;
}) => authenticateApiPrincipal(event.request, `${event.url.origin}/api/v1`);
