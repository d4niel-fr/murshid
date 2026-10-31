/**
 * The API's routes start at "/". On Vercel it is mounted under a path (the "api" service receives /api/...), so the
 * entry strips that prefix before the request reaches the app. A request without the prefix passes through unchanged,
 * which keeps direct calls and local development (http://localhost:8787/health) working.
 */
export function stripPrefix(req: Request, prefix: string): Request {
  const url = new URL(req.url);
  if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return req;
  url.pathname = url.pathname.slice(prefix.length) || '/';
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.body !== null;
  // a streamed body needs duplex: 'half' (Node's fetch); headers, method and abort signal carry over unchanged
  return new Request(url, { method: req.method, headers: req.headers, body: hasBody ? req.body : undefined, signal: req.signal, redirect: req.redirect, ...(hasBody ? { duplex: 'half' } : {}) } as RequestInit);
}
