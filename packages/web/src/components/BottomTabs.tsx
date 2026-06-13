import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { useI18n } from '@smart-files/shared/src/i18n';
import { FolderIcon, FolderOpenIcon, CloudArrowUpIcon, GearIcon, ImageIcon, AlbumsIcon } from './icons';

const tabs: { path: string; icon: typeof FolderIcon; activeIcon: typeof FolderIcon; labelKey: string }[] = [
  { path: '/files', labelKey: 'files', icon: FolderIcon, activeIcon: FolderOpenIcon },
  { path: '/photos', labelKey: 'photos', icon: ImageIcon, activeIcon: ImageIcon },
  { path: '/albums', labelKey: 'albums', icon: AlbumsIcon, activeIcon: AlbumsIcon },
  { path: '/uploads', labelKey: 'uploads', icon: CloudArrowUpIcon, activeIcon: CloudArrowUpIcon },
  { path: '/settings', labelKey: 'settings', icon: GearIcon, activeIcon: GearIcon },
];

export function BottomTabs() {
  const location = useLocation();
  const { t } = useI18n();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex h-16 max-w-3xl mx-auto">
        {tabs.map(tab => {
          const isActive = location.pathname === tab.path;
          const Icon = isActive ? tab.activeIcon : tab.icon;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className="relative flex flex-1 flex-col items-center justify-center gap-1"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-blue-500 rounded-b-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className={`w-6 h-6 transition-colors ${isActive ? 'text-blue-500' : 'text-zinc-400 dark:text-zinc-500'}`} />
              <span className={`text-[11px] font-medium transition-colors ${isActive ? 'text-blue-500' : 'text-zinc-400 dark:text-zinc-500'}`}>
                {t[tab.labelKey as keyof typeof t] as string}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
