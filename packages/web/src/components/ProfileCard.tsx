import { useAuth } from '../context/AuthContext';

export function ProfileCard() {
  const { user } = useAuth();
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? '?';

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-lg font-bold">
        {initials}
      </div>
      <div className="min-w-0">
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          {user?.name || 'User'}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{user?.email}</p>
      </div>
    </div>
  );
}
