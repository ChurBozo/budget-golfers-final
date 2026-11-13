// MODEL: rounds. Summaries come from the list; holes and shots only from
// GET /api/rounds/:roundId, when a round is opened (FR4).
import { request } from './apiClient';

/** filters: { from, to, courseId, holes, sort, page, limit } -> { data, meta, links } */
export async function list(filters, signal) {
  const { data, meta, links } = await request('/api/rounds', { query: filters, signal });
  return { data, meta, links };
}

export async function get(roundId, signal) {
  return (await request(`/api/rounds/${roundId}`, { signal })).data;
}

export async function update(roundId, patch) {
  return (await request(`/api/rounds/${roundId}`, { method: 'PATCH', body: patch })).data;
}

export async function remove(roundId) {
  await request(`/api/rounds/${roundId}`, { method: 'DELETE' });
}
