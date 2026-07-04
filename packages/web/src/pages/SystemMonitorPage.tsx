import { useNavigate } from 'react-router-dom';
import { useI18n } from '@smart-files/shared/src/i18n';
import { SystemDashboard } from '../components/SystemDashboard';
import { ChevronLeftIcon } from '../components/icons';

export function SystemMonitorPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/settings')}
          className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </button>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{t.systemMonitor}</h1>
      </div>

      <SystemDashboard />
    </div>
  );
}
