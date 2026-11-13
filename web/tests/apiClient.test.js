// The model layer's one HTTP function, against a fake fetch.
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ApiError, buildQuery, configureApi, request } from '../src/services/apiClient';

function reply(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new Error('no body')) : Promise.resolve(body)),
    headers: new Headers(),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('apiClient.request', () => {
  test('adds the token and query, and unwraps the envelope', async () => {
    const fetchMock = vi.fn(() => reply(200, { success: true, data: [{ id: 'r1' }], meta: { total: 1 } }));
    vi.stubGlobal('fetch', fetchMock);
    configureApi({ getToken: () => 'token-1' });

    const result = await request('/api/rounds', { query: { holes: 18, courseId: '', page: 2 } });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/rounds?holes=18&page=2'); // empty values left out
    expect(options.headers.Authorization).toBe('Bearer token-1');
    expect(result).toEqual({ status: 200, data: [{ id: 'r1' }], meta: { total: 1 }, links: undefined });
  });

  test('turns the API error envelope into one ApiError with field errors', async () => {
    vi.stubGlobal('fetch', () =>
      reply(422, {
        success: false,
        error: {
          status: 422,
          code: 'VALIDATION_FAILED',
          message: 'Some fields are not valid.',
          details: [{ field: 'displayName', issue: 'must be 2 to 30 characters' }],
          requestId: 'req_7f3a2c',
        },
      }),
    );
    const err = await request('/api/users/x', { method: 'PATCH', body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 422, code: 'VALIDATION_FAILED', requestId: 'req_7f3a2c' });
    expect(err.fieldErrors()).toEqual({ displayName: 'must be 2 to 30 characters' });
  });

  test('a 401 signs the golfer out, except on the sign-in request itself', async () => {
    const onUnauthorized = vi.fn();
    configureApi({ onUnauthorized });
    vi.stubGlobal('fetch', () => reply(401, { success: false, error: { status: 401, code: 'UNAUTHENTICATED', message: 'Expired' } }));

    await expect(request('/api/rounds')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    await expect(request('/api/auth/login', { method: 'POST', auth: false, body: {} })).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  test('no connection gives a friendly NETWORK error', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    const err = await request('/api/health').catch((e) => e);
    expect(err.isNetwork).toBe(true);
    expect(err.message).toMatch(/Couldn't reach the Budget Golfers server/);
  });

  test('204 No Content and non-JSON 5xx replies', async () => {
    vi.stubGlobal('fetch', () => reply(204));
    await expect(request('/api/rounds/r1', { method: 'DELETE' })).resolves.toEqual({ status: 204, data: null });

    vi.stubGlobal('fetch', () => reply(502));
    await expect(request('/api/rounds')).rejects.toMatchObject({ status: 502, code: 'UNEXPECTED_RESPONSE' });
  });

  test('an aborted request is passed through, not turned into an error message', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new DOMException('aborted', 'AbortError')));
    await expect(request('/api/rounds')).rejects.toMatchObject({ name: 'AbortError' });
  });

  test('buildQuery', () => {
    expect(buildQuery({ sort: 'avgScore', period: undefined, page: 1 })).toBe('?sort=avgScore&page=1');
    expect(buildQuery({})).toBe('');
  });
});
