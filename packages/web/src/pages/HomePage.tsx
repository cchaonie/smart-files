import { Link } from 'react-router-dom';
import { useI18n } from '@smart-files/shared/src/i18n';
import { motion, useReducedMotion } from 'motion/react';
import { CloudArrowUpIcon } from '@phosphor-icons/react';

// Accent color: Cobalt blue - avoiding AI-purple and beige+brass traps
const ACCENT = {
  light: '#2563eb',
  dark: '#3b82f6',
  glow: 'rgba(37, 99, 235, 0.15)',
};

function AnimatedButton({
  to,
  children,
  variant = 'primary',
  className = '',
}: {
  to: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  className?: string;
}) {
  const reduce = useReducedMotion();
  const isPrimary = variant === 'primary';

  return (
    <motion.div
      whileHover={reduce ? undefined : { scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
    >
      <Link
        to={to}
        className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition-colors ${
          isPrimary
            ? 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100'
            : 'border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800'
        } ${className}`}
        style={isPrimary ? { backgroundColor: ACCENT.light } : undefined}
      >
        {children}
      </Link>
    </motion.div>
  );
}

export function HomePage() {
  const { t } = useI18n();
  const reduce = useReducedMotion();

  return (
    <div
      className='min-h-screen bg-white dark:bg-zinc-950'
      style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
    >
      {/* Navigation */}
      <motion.nav
        initial={reduce ? false : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className='fixed left-0 right-0 top-0 z-50 border-b border-zinc-200/50 bg-white/80 backdrop-blur-md dark:border-zinc-800/50 dark:bg-zinc-950/80'
      >
        <div className='mx-auto flex h-16 max-w-7xl items-center justify-start px-4 sm:px-6 lg:px-8  gap-2'>
          <div
            className='flex h-8 w-8 items-center justify-center rounded-lg'
            style={{ backgroundColor: ACCENT.light }}
          >
            <CloudArrowUpIcon className='h-5 w-5 text-white' weight='bold' />
          </div>
          <span className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
            {t.appName}
          </span>
        </div>
      </motion.nav>

      {/* Hero Section - Asymmetric Split */}
      <section className='relative pt-2'>
        <div className='mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl grid-cols-1 items-center gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8'>
          <motion.div
            initial={reduce ? false : { opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className='flex flex-col justify-center items-center py-12 lg:py-0'
          >
            <div
              className='mb-6 inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium'
              style={{
                backgroundColor: `${ACCENT.light}15`,
                color: ACCENT.light,
              }}
            >
              <span className='relative flex h-2 w-2'>
                <span
                  className='absolute inline-flex h-full w-full animate-ping rounded-full opacity-75'
                  style={{ backgroundColor: ACCENT.light }}
                />
                <span
                  className='relative inline-flex h-2 w-2 rounded-full'
                  style={{ backgroundColor: ACCENT.light }}
                />
              </span>
              Free for personal use
            </div>

            <h1 className='text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl lg:text-6xl'>
              File storage
              <br />
              <span style={{ color: ACCENT.light }}>without limits</span>
            </h1>

            <p className='mt-6 max-w-md text-lg leading-relaxed text-zinc-600 dark:text-zinc-400'>
              Upload gigabytes with confidence. Pause and resume anytime. Your
              files, your folders, your rules.
            </p>

            <div className='mt-8 flex flex-wrap gap-3'>
              <AnimatedButton to='/register'>
                Start uploading free
              </AnimatedButton>
            </div>
            <div className='mt-8 flex flex-wrap gap-3'>
              <AnimatedButton to='/login' variant='secondary'>
                Sign in
              </AnimatedButton>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
    </div>
  );
}
