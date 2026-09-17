import type { RequestHandler } from './$types';
import { protectedResourceMetadata } from '$lib/server/oauth/http';

export const GET: RequestHandler = ({ url }) =>
  protectedResourceMetadata(url.origin, '/api/v1');
