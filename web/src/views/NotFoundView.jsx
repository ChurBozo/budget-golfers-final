// VIEW (route): * (anything else). The client's own 404, like the API's.
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import logo from '../assets/logo.svg';

export default function NotFoundView() {
  const { isSignedIn } = useAuth();
  const headingRef = usePageTitle('Page not found');
  return (
    <main className="not-found">
      <div className="card">
        <img src={logo} alt="" width="56" height="56" />
        <h1 ref={headingRef} tabIndex={-1}>
          This hole isn&rsquo;t on the card
        </h1>
        <p className="muted">The page you asked for doesn&rsquo;t exist. It may have moved, or the link is wrong.</p>
        <Link className="btn" to={isSignedIn ? '/dashboard' : '/login'}>
          {isSignedIn ? 'Back to the dashboard' : 'Go to sign in'}
        </Link>
      </div>
    </main>
  );
}
