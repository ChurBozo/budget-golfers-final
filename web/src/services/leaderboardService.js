// MODEL: the community leaderboard.
import { request } from './apiClient';

/** { sort, period, page, limit } -> { data, meta } */
export async function list(query, signal) {
  const { data, meta } = await request('/api/leaderboard', { query, signal });
  return { data, meta };
}
