// VIEWMODEL for Settings: saving the profile (with field errors from a 422),
// downloading the golfer's data and deleting the account.
import { useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as usersService from '../services/usersService';
import { invalidate } from '../services/cache';

export function useProfile() {
  const { user, updateUser, signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const saveProfile = useCallback(
    async (patch) => {
      setSaving(true);
      setSaved(false);
      setError(null);
      setFieldErrors({});
      try {
        const updated = await usersService.update(user.id, patch);
        updateUser(updated);
        invalidate('leaderboard:');
        setSaved(true);
        return true;
      } catch (err) {
        setError(err);
        setFieldErrors(err.fieldErrors ? err.fieldErrors() : {});
        return false;
      } finally {
        setSaving(false);
      }
    },
    [user, updateUser],
  );

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const deleteAccount = useCallback(async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await usersService.remove(user.id);
      signOut();
      return true;
    } catch (err) {
      setDeleteError(err);
      return false;
    } finally {
      setDeleting(false);
    }
  }, [user, signOut]);

  return { user, saveProfile, saving, saved, error, fieldErrors, deleteAccount, deleting, deleteError };
}

/** DataExport: GET /api/users/:userId/export?format= saved as a file download. */
export function useExport() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(null); // 'csv' | 'json' | null
  const [error, setError] = useState(null);

  const download = useCallback(
    async (format) => {
      setBusy(format);
      setError(null);
      try {
        const { blob, filename } = await usersService.exportFile(user.id, format);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (err) {
        setError(err);
      } finally {
        setBusy(null);
      }
    },
    [user],
  );

  return { download, busy, error };
}
