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

const createAbortError = () =>
  new DOMException('This operation was aborted', 'AbortError');

const hasHeader = (headers: OutgoingHttpHeaders, name: string) =>
  Object.keys(headers).some((key) => key.toLowerCase() === name);

const prepareBody = async (
  init: RequestInit,
  headers: OutgoingHttpHeaders,
) => {
  if (init.body == null) {
    return null;
  }

  const bodyResponse = new Response(init.body);
  const contentType = bodyResponse.headers.get('content-type');
  const body = Buffer.from(await bodyResponse.arrayBuffer());

  if (contentType && !hasHeader(headers, 'content-type')) {
    headers['content-type'] = contentType;
  }
  if (!hasHeader(headers, 'content-length')) {
    headers['content-length'] = body.byteLength;
  }

  return body;
};

const createRequestOptions = (
  init: RequestInit,
  proxyUrl: string,
  headers: OutgoingHttpHeaders,
) => {
  const agent = isSocksProxy(proxyUrl)
    ? new SocksProxyAgent(proxyUrl)
    : new HttpsProxyAgent(proxyUrl);

  return {
    method: init.method ?? 'GET',
    headers,
    agent,
  };
};

const fetchThroughProxy = async (
  url: URL,
  init: RequestInit,
  proxyUrl: string,
): Promise<Response> => {
  if (url.protocol !== 'https:') {
    throw new Error('Integration proxy only supports HTTPS upstream URLs');
  }
  if (init.signal?.aborted) {
    throw createAbortError();
  }

  const headers = normalizeHeaders(init.headers);
  const body = await prepareBody(init, headers);
  if (init.signal?.aborted) {
    throw createAbortError();
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let req: ReturnType<typeof https.request> | null = null;
    let abortHandler: (() => void) | null = null;

    const settle = <T>(callback: (value: T) => void, value: T) => {
      if (settled) return;
      settled = true;
      if (init.signal && abortHandler) {
        init.signal.removeEventListener('abort', abortHandler);
      }
      callback(value);
    };

    abortHandler = init.signal
      ? () => {
          const err = createAbortError();
          req?.destroy(err);
          settle(reject, err);
        }
      : null;

    req = https.request(
      url,
      createRequestOptions(init, proxyUrl, headers),
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
        settle(
          resolve,
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

    req.on('error', (err) => settle(reject, err));

    if (init.signal && abortHandler) {
      init.signal.addEventListener('abort', abortHandler, { once: true });
    }

    if (body) {
      req.write(body);
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
