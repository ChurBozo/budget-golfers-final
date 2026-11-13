// MODEL: the signed-in golfer's account.
import { request } from './apiClient';

export async function me(signal) {
  return (await request('/api/users/me', { signal })).data;
}

export async function update(userId, patch) {
  return (await request(`/api/users/${userId}`, { method: 'PATCH', body: patch })).data;
}

export async function remove(userId) {
  await request(`/api/users/${userId}`, { method: 'DELETE' });
}

/** GET /api/users/:userId/export?format=csv|json -> { blob, filename } */
export async function exportFile(userId, format) {
  const response = await request(`/api/users/${userId}/export`, { query: { format }, raw: true });
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename = match ? match[1] : `budget-golfers.${format}`;
  return { blob: await response.blob(), filename };
}
