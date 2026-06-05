import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '@smart-files/shared/src/i18n';
import { motion, useReducedMotion } from 'motion/react';
import {
  CloudArrowUpIcon,
  EnvelopeIcon,
  LockIcon,
  ArrowRightIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@phosphor-icons/react';

const ACCENT = {
  light: '#2563eb',
  dark: '#3b82f6',
  glow: 'rgba(37, 99, 235, 0.15)',
};

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useI18n();
  const reduce = useReducedMotion();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email, password);
      navigate('/files');
    } catch (err: any) {
      setError(err.response?.data?.error || t.loginFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className='relative min-h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950'
      style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
    >
      {/* Background gradient */}
      <div
        className='fixed inset-0 opacity-30 dark:opacity-20'
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% -20%, ${ACCENT.glow || 'rgba(37, 99, 235, 0.15)'}, transparent)`,
        }}
      />

      {/* Navigation */}
      <motion.nav
        initial={reduce ? false : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className='mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8'>
          <Link to='/' className='flex items-center gap-2'>
            <div
              className='flex h-8 w-8 items-center justify-center rounded-lg'
              style={{ backgroundColor: ACCENT.light }}
            >
              <CloudArrowUpIcon className='h-5 w-5 text-white' weight='bold' />
            </div>
            <span className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
              {t.appName}
            </span>
          </Link>
        </div>
      </motion.nav>

      {/* Main content */}
      <div className='relative flex items-center justify-center px-4 py-4'>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className='w-full max-w-md'
        >
          {/* Glassmorphism card */}
          <div className='relative overflow-hidden rounded-3xl border border-zinc-200/50 bg-white/80 p-8 shadow-xl backdrop-blur-xl dark:border-zinc-700/50 dark:bg-zinc-900/80 sm:p-10'>
            {/* Subtle gradient overlay */}
            <div
              className='pointer-events-none absolute inset-0 opacity-50'
              style={{
                background: `radial-gradient(600px circle at 100% 0%, ${ACCENT.glow || 'rgba(37, 99, 235, 0.1)'}, transparent 50%)`,
              }}
            />

            <div className='relative'>
              {/* Header */}
              <div className='text-center'>
                <h1 className='text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50'>
                  {t.signInTitle}
                </h1>
                <p className='mt-2 text-sm text-zinc-600 dark:text-zinc-400'>
                  {t.signInSubtitle}
                </p>
              </div>

              {/* Form */}
              <form className='mt-8 space-y-5' onSubmit={onSubmit}>
                {/* Email field */}
                <div>
                  <label
                    htmlFor='email'
                    className='mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300'
                  >
                    {t.email}
                  </label>
                  <div className='relative'>
                    <div className='pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3'>
                      <EnvelopeIcon className='h-5 w-5 text-zinc-400' />
                    </div>
                    <input
                      id='email'
                      type='email'
                      autoComplete='email'
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className='block w-full rounded-xl border border-zinc-300 bg-white/50 py-3 pl-10 pr-4 text-zinc-900 placeholder-zinc-400 outline-none transition-all focus:border-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus:bg-zinc-800 dark:focus:ring-zinc-400/10'
                      placeholder={t.emailPlaceholder}
                    />
                  </div>
                </div>

                {/* Password field */}
                <div>
                  <label
                    htmlFor='password'
                    className='mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300'
                  >
                    {t.password}
                  </label>
                  <div className='relative'>
                    <div className='pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3'>
                      <LockIcon className='h-5 w-5 text-zinc-400' />
                    </div>
                    <input
                      id='password'
                      type={showPassword ? 'text' : 'password'}
                      autoComplete='current-password'
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className='block w-full rounded-xl border border-zinc-300 bg-white/50 py-3 pl-10 pr-12 text-zinc-900 placeholder-zinc-400 outline-none transition-all focus:border-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus:bg-zinc-800 dark:focus:ring-zinc-400/10'
                      placeholder={t.passwordPlaceholder}
                    />
                    <button
                      type='button'
                      onClick={() => setShowPassword(!showPassword)}
                      className='absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300'
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeSlashIcon className='h-5 w-5' />
                      ) : (
                        <EyeIcon className='h-5 w-5' />
                      )}
                    </button>
                  </div>
                </div>

                {/* Error message */}
                {error && (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className='rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400'
                  >
                    {error}
                  </motion.div>
                )}

                {/* Submit button */}
                <motion.button
                  type='submit'
                  disabled={pending}
                  whileHover={reduce ? undefined : { scale: 1.01 }}
                  whileTap={reduce ? undefined : { scale: 0.99 }}
                  className='group relative flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
                  style={{ backgroundColor: ACCENT.light }}
                >
                  {pending ? (
                    <>
                      <span className='h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white' />
                      {t.signingIn}
                    </>
                  ) : (
                    <>
                      {t.signIn}
                      <ArrowRightIcon className='h-4 w-4 transition-transform group-hover:translate-x-0.5' />
                    </>
                  )}
                </motion.button>
              </form>

              {/* Sign up link */}
              <p className='mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400'>
                {t.noAccount}{' '}
                <Link
                  to='/register'
                  className='font-medium transition-colors hover:underline'
                  style={{ color: ACCENT.light }}
                >
                  {t.registerLink}
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
