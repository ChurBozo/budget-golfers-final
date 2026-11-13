// MODEL: the one place that talks HTTP to the Budget Golfers API.
// Every service module goes through request(), which adds the Bearer token,
// checks response.ok, unwraps the { success, data, meta, links } envelope and
// throws one ApiError type for every failure (A2 section 5.7).

export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor({ status = 0, code = 'ERROR', message = 'Something went wrong.', details = [], requestId } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  get isNetwork() {
    return this.status === 0;
  }

  /** { email: 'must be a valid email address', ... } from a 422 reply. */
  fieldErrors() {
    return Object.fromEntries(this.details.map((d) => [d.field, d.issue]));
  }
}

// Set by AuthContext, so the service layer never imports React.
let getToken = () => null;
let onUnauthorized = () => {};

export function configureApi(options) {
  if (options.getToken) getToken = options.getToken;
  if (options.onUnauthorized) onUnauthorized = options.onUnauthorized;
}

export function buildQuery(query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

/**
 * @param {string} path  e.g. "/api/rounds"
 * @param {object} options  method, body, query, signal, auth (default true), raw (return the Response)
 */
export async function request(path, { method = 'GET', body, query, signal, auth = true, raw = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError({
      status: 0,
      code: 'NETWORK',
      message: "Couldn't reach the Budget Golfers server. Check your connection and try again.",
    });
  }

  if (raw && response.ok) return response;
  if (response.status === 204) return { status: 204, data: null };

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok || json?.success === false) {
    const error = new ApiError(
      json?.error ?? {
        status: response.status,
        code: 'UNEXPECTED_RESPONSE',
        message:
          response.status >= 500
            ? 'The Budget Golfers server had a problem. Please try again shortly.'
            : `Unexpected reply from the server (HTTP ${response.status}).`,
      },
    );
    // An expired or invalid token signs the golfer out (A2 section 5.6).
    if (error.status === 401 && auth) onUnauthorized(error);
    throw error;
  }

  return { status: response.status, data: json?.data ?? null, meta: json?.meta, links: json?.links };
}
