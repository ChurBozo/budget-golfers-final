// MODEL: calculated statistics. One request feeds the stat cards, the score
// trend and the accuracy card (A2 Table 5).
import { request } from './apiClient';

export async function get(userId, period, signal) {
  return (await request(`/api/stats/${userId}`, { query: { period }, signal })).data;
}
