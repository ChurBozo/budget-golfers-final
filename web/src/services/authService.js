// MODEL: accounts. POST /api/auth/login and /api/auth/register.
import { request } from './apiClient';

export async function login({ email, password }) {
  const { data } = await request('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: { email: email.trim(), password, client: 'web' },
  });
  return data; // { token, expiresIn, user }
}

export async function register({ email, password, displayName, homeCourseName }) {
  const body = { email: email.trim(), password, displayName: displayName.trim(), client: 'web' };
  if (homeCourseName && homeCourseName.trim()) body.homeCourseName = homeCourseName.trim();
  const { data } = await request('/api/auth/register', { method: 'POST', auth: false, body });
  return data;
}
