import { env } from '$env/dynamic/private';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type { OutgoingHttpHeaders } from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';
import { SocksProxyAgent } from 'socks-proxy-agent';

const getProxyUrl = () => env.INTEGRATIONS_PROXY_URL?.trim() || null;

const normalizeHeaders = (headersInit: RequestInit['headers']) => {
  const headers: OutgoingHttpHeaders = {};
  new Headers(headersInit).forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
};

const isSocksProxy = (proxyUrl: string) => {
  const protocol = new URL(proxyUrl).protocol;
  return protocol === 'socks5:' || protocol === 'socks5h:';
};

const responseCannotHaveBody = (status: number) =>
  status === 204 || status === 205 || status === 304;

const writeBody = (req: ReturnType<typeof https.request>, body: BodyInit) => {
  if (
    typeof body === 'string' ||
    body instanceof Uint8Array ||
    Buffer.isBuffer(body)
  ) {
    req.write(body);
    return;
  }

  if (body instanceof ArrayBuffer) {
    req.write(Buffer.from(body));
    return;
  }

  if (body instanceof URLSearchParams) {
    req.write(body.toString());
    return;
  }

  throw new Error('Unsupported integration proxy request body type');
};

const createRequestOptions = (init: RequestInit, proxyUrl: string) => {
  const agent = isSocksProxy(proxyUrl)
    ? new SocksProxyAgent(proxyUrl)
    : new HttpsProxyAgent(proxyUrl);

  return {
    method: init.method ?? 'GET',
    headers: normalizeHeaders(init.headers),
    agent,
  };
};

const fetchThroughProxy = (
  url: URL,
  init: RequestInit,
  proxyUrl: string,
): Promise<Response> => {
  if (url.protocol !== 'https:') {
    throw new Error('Integration proxy only supports HTTPS upstream URLs');
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      createRequestOptions(init, proxyUrl),
      (res) => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(res.headers)) {
          if (Array.isArray(value)) {
            for (const item of value) headers.append(key, item);
          } else if (value !== undefined) {
            headers.set(key, String(value));
          }
        }

        const status = res.statusCode ?? 500;
        resolve(
          new Response(
            responseCannotHaveBody(status)
              ? null
              : (Readable.toWeb(res) as ReadableStream),
            {
              status,
              statusText: res.statusMessage ?? '',
              headers,
            },
          ),
        );
      },
    );

    req.on('error', reject);

    if (init.signal) {
      init.signal.addEventListener(
        'abort',
        () => req.destroy(new Error('Request aborted')),
        { once: true },
      );
    }

    if (init.body) {
      writeBody(req, init.body);
    }

    req.end();
  });
};

export const fetchIntegration = async (
  input: string | URL,
  init: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
) => {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) {
    return fetchImpl(input, init);
  }

  return fetchThroughProxy(new URL(input), init, proxyUrl);
};
