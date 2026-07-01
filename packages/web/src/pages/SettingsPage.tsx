import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '@smart-files/shared/src/i18n';
import { useUpload } from '../context/UploadContext';
import { ProfileCard } from '../components/ProfileCard';
import { LanguagePicker } from '../components/LanguagePicker';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { GlobeIcon, LockIcon, ArrowRightIcon, CloudArrowUpIcon, GearIcon } from '../components/icons';

export function SettingsPage() {
  const { t } = useI18n();
  const { logout } = useAuth();
  const { maxParallel, setMaxParallel } = useUpload();
  const navigate = useNavigate();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  function handleLogout() {
    logout();
    window.location.href = '/login';
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{t.settings}</h1>

      <ProfileCard />

      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
        <button
          onClick={() => navigate('/settings/monitor')}
          className="flex items-center gap-3 w-full p-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <GearIcon className="w-5 h-5 text-zinc-500" />
          <span className="flex-1 text-sm text-zinc-900 dark:text-zinc-100">{t.systemMonitor}</span>
          <ArrowRightIcon className="w-4 h-4 text-zinc-400" />
        </button>

        <button
          onClick={() => setShowLanguagePicker(true)}
          className="flex items-center gap-3 w-full p-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <GlobeIcon className="w-5 h-5 text-zinc-500" />
          <span className="flex-1 text-sm text-zinc-900 dark:text-zinc-100">{t.language}</span>
          <ArrowRightIcon className="w-4 h-4 text-zinc-400" />
        </button>

        <button
          onClick={() => setShowChangePassword(true)}
          className="flex items-center gap-3 w-full p-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <LockIcon className="w-5 h-5 text-zinc-500" />
          <span className="flex-1 text-sm text-zinc-900 dark:text-zinc-100">{t.changePassword}</span>
          <ArrowRightIcon className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* Parallel uploads setting */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900">
        <div className="flex items-center gap-3 p-4">
          <CloudArrowUpIcon className="w-5 h-5 text-zinc-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-900 dark:text-zinc-100">{t.parallelUploads}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{t.parallelUploadsDesc}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMaxParallel(maxParallel - 1)}
              className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-30"
              disabled={maxParallel <= 1}
            >−</button>
            <span className="w-8 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-100">{maxParallel}</span>
            <button
              onClick={() => setMaxParallel(maxParallel + 1)}
              className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-30"
              disabled={maxParallel >= 10}
            >+</button>
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowLogoutConfirm(true)}
        className="flex items-center justify-center gap-2 w-full p-4 rounded-xl bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      >
        {t.signOut}
      </button>

      <LanguagePicker isOpen={showLanguagePicker} onClose={() => setShowLanguagePicker(false)} />
      <ChangePasswordModal isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 text-center">{t.signOut}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mt-1">{t.signOutConfirm}</p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm font-medium"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium"
              >
                {t.signOut}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
