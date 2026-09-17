import type { RequestHandler } from './$types';
import document from '$lib/api/v1/openapi.yaml?raw';
export const GET: RequestHandler = async () =>
  new Response(document, {
    headers: {
      'Content-Type': 'application/yaml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
