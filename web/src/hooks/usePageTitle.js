// When the view changes, update the document title ("Rounds | Budget Golfers")
// and move focus to the view heading so screen reader users hear the change
// (A2 section 5.4).
import { useEffect, useRef } from 'react';

export function usePageTitle(title) {
  const headingRef = useRef(null);
  useEffect(() => {
    document.title = title ? `${title} | Budget Golfers` : 'Budget Golfers';
  }, [title]);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  return headingRef;
}
