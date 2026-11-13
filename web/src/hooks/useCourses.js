// VIEWMODEL for the course drop-downs (FilterBar, home course). Cached for
// the session (A2 Table 5).
import { useAuth } from '../context/AuthContext';
import * as coursesService from '../services/coursesService';
import { useResource } from './useResource';

export function useCourses() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useResource(user ? `courses:${user.id}` : null, (signal) =>
    coursesService.list({ limit: 100 }, signal),
  );
  return { courses: data?.data ?? [], loading, error, reload };
}
