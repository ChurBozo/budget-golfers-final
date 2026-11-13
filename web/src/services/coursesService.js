// MODEL: the golfer's own (self-named) courses, for the course filter and
// the home course drop-down.
import { request } from './apiClient';

export async function list({ search, limit = 100 } = {}, signal) {
  const { data, meta } = await request('/api/courses', { query: { search, limit }, signal });
  return { data, meta };
}
