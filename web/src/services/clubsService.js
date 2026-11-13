// MODEL: the golfer's bag and club distances.
import { request } from './apiClient';

export async function get(userId, signal) {
  return (await request(`/api/clubs/${userId}`, { signal })).data;
}

export async function replace(userId, clubs) {
  return (await request(`/api/clubs/${userId}`, { method: 'PUT', body: { clubs } })).data;
}
