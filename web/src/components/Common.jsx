// VIEW: small presentational pieces shared by every view. They only render
// props; none of them fetch data.
import { useEffect, useRef } from 'react';

/** An icon from the template's SVG sprite (index.html). */
export function Icon({ name }) {
  return (
    <svg className="icon" aria-hidden="true" focusable="false">
      <use href={`#i-${name}`} />
    </svg>
  );
}

/** The template's design annotation, shown by "Show API annotations" in the footer. */
export function ApiTag({ children }) {
  return <span className="api-tag">{children}</span>;
}

/** Loading: a grey shimmer in the shape of the content. */
export function Skeleton({ lines = 4, label = 'Loading' }) {
  return (
    <div className="skeleton" aria-busy="true" aria-label={label} role="status">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}

/** Error: a short message and a Retry button. */
export function ErrorState({ title = "Couldn't load this.", error, onRetry }) {
  const notFound = error?.status === 404 || error?.status === 403;
  return (
    <div className="state state-error" role="alert">
      <Icon name="alert" />
      <p>
        <b>{notFound ? 'Not found.' : title}</b>
        <br />
        {notFound
          ? 'It may have been deleted, or the link is wrong.'
          : error?.message || 'Check your connection and try again.'}
        {onRetry && !notFound && (
          <>
            <br />
            <button type="button" className="btn btn-sm btn-ghost" style={{ marginTop: 8 }} onClick={onRetry}>
              Retry
            </button>
          </>
        )}
      </p>
    </div>
  );
}

/** Empty: a friendly message saying what to do next. */
export function EmptyState({ icon = 'rounds', children }) {
  return (
    <div className="state state-empty">
      <Icon name={icon} />
      <p>{children}</p>
    </div>
  );
}

/** A success or information message, e.g. "Profile saved". */
export function Notice({ children, tone = 'ok' }) {
  return (
    <div className={tone === 'error' ? 'state state-error' : 'state state-empty notice'} role="status">
      <p>{children}</p>
    </div>
  );
}

/**
 * A confirm dialog. Escape or Cancel closes it; focus starts on Cancel so a
 * stray Enter never deletes anything.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, danger = true, busy, onConfirm, onCancel, confirmDisabled }) {
  const cancelRef = useRef(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  // Only when the dialog opens: re-running this on every render would pull
  // focus back to Cancel while the golfer types in the dialog.
  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onCancelRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="card modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">{title}</h2>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          <button ref={cancelRef} type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? 'btn btn-danger' : 'btn'}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
