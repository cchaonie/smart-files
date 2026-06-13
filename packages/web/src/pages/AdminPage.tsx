import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '@smart-files/shared/src/i18n';
import apiClient from '../api/client';
import { ShieldIcon } from '../components/icons';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  photoCount: number;
}

export function AdminPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Redirect non-admin users
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/files', { replace: true });
    }
  }, [user, navigate]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<AdminUser[]>('/admin/users');
      setUsers(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load users';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleResetPassword = async (userId: string) => {
    setActionMsg(null);
    try {
      const res = await apiClient.post<{ temporaryPassword: string }>(`/admin/users/${userId}/reset-password`);
      setActionMsg({ type: 'success', text: `Temporary password: ${res.data.temporaryPassword}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset password';
      setActionMsg({ type: 'error', text: msg });
    }
  };

  const handleToggleRole = async (userId: string, currentRole: string) => {
    setActionMsg(null);
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await apiClient.patch(`/admin/users/${userId}/role`, { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setActionMsg({ type: 'success', text: `Role changed to ${newRole}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change role';
      setActionMsg({ type: 'error', text: msg });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <p className="text-zinc-500">{t.loading}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-lg bg-red-900/20 border border-red-800 p-4 text-red-400">
          <p>{error}</p>
          <button
            onClick={fetchUsers}
            className="mt-2 text-sm text-red-300 underline hover:text-red-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <ShieldIcon className="w-7 h-7 text-blue-500" />
        <h1 className="text-xl font-bold text-zinc-100">{t.admin.title}</h1>
      </div>

      {actionMsg && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            actionMsg.type === 'success'
              ? 'bg-emerald-900/20 border border-emerald-800 text-emerald-400'
              : 'bg-red-900/20 border border-red-800 text-red-400'
          }`}
        >
          {actionMsg.text}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-zinc-700">
              <th className="py-3 px-2 text-zinc-400 font-medium">Email</th>
              <th className="py-3 px-2 text-zinc-400 font-medium">Name</th>
              <th className="py-3 px-2 text-zinc-400 font-medium">Role</th>
              <th className="py-3 px-2 text-zinc-400 font-medium">Created</th>
              <th className="py-3 px-2 text-zinc-400 font-medium">Photos</th>
              <th className="py-3 px-2 text-zinc-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                <td className="py-3 px-2 text-zinc-100">{u.email}</td>
                <td className="py-3 px-2 text-zinc-300">{u.name || '—'}</td>
                <td className="py-3 px-2">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      u.role === 'admin'
                        ? 'bg-blue-900/30 text-blue-400 border border-blue-700'
                        : 'bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="py-3 px-2 text-zinc-400 text-xs">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3 px-2 text-zinc-400">{u.photoCount}</td>
                <td className="py-3 px-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleResetPassword(u.id)}
                      className="rounded bg-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-600 transition-colors"
                    >
                      Reset PW
                    </button>
                    <button
                      onClick={() => handleToggleRole(u.id, u.role)}
                      className={`rounded px-2.5 py-1 text-xs transition-colors ${
                        u.role === 'admin'
                          ? 'bg-amber-900/30 text-amber-400 border border-amber-700 hover:bg-amber-800/40'
                          : 'bg-blue-900/30 text-blue-400 border border-blue-700 hover:bg-blue-800/40'
                      }`}
                    >
                      {u.role === 'admin' ? 'Demote' : 'Promote'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <p className="text-center text-zinc-500 py-12">No users found.</p>
      )}
    </div>
  );
}

export default AdminPage;
