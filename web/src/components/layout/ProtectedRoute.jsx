// Guarding (A2 section 5.4): with no valid token, go to /login and remember
// where the golfer was going, so they return there after signing in.
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function ProtectedRoute({ children }) {
  const { isSignedIn, expired } = useAuth();
  const location = useLocation();
  if (!isSignedIn) {
    return <Navigate to="/login" replace state={{ from: location, expired }} />;
  }
  return children;
}
