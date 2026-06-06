import { Outlet } from 'react-router-dom';
import { BottomTabs } from './BottomTabs';

export function AppLayout() {
  return (
    <div className="min-h-[100dvh] bg-zinc-50 dark:bg-zinc-950">
      <main className="pb-20 max-w-3xl mx-auto">
        <Outlet />
      </main>
      <BottomTabs />
    </div>
  );
}
