import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '@smart-files/shared/src/i18n'
import { motion, useReducedMotion } from 'motion/react'
import { CloudArrowUp, Envelope, Lock, User, ArrowRight, Eye, EyeSlash, CheckCircle } from '@phosphor-icons/react'

const ACCENT = {
  light: '#2563eb',
  dark: '#3b82f6',
  glow: 'rgba(37, 99, 235, 0.15)'
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const { t } = useI18n()
  const reduce = useReducedMotion()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [success, setSuccess] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError(t.passwordMinLength)
      return
    }

    setPending(true)
    try {
      await register(email, password, name || undefined)
      setSuccess(true)
      setTimeout(() => navigate('/files'), 800)
    } catch (err: any) {
      setError(err.response?.data?.error || t.registrationFailed)
    } finally {
      setPending(false)
    }
  }

  const passwordStrength = password.length >= 8 ? 'strong' : password.length >= 6 ? 'medium' : 'weak'
  const strengthColor = {
    weak: 'bg-red-500',
    medium: 'bg-yellow-500',
    strong: 'bg-emerald-500'
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950" style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>
      {/* Background gradient */}
      <div 
        className="fixed inset-0 opacity-30 dark:opacity-20"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% -20%, ${ACCENT.glow || 'rgba(37, 99, 235, 0.15)'}, transparent)`
        }}
      />
      
      {/* Navigation */}
      <motion.nav
        initial={reduce ? false : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="fixed left-0 right-0 top-0 z-50"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <div 
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: ACCENT.light }}
            >
              <CloudArrowUp className="h-5 w-5 text-white" weight="bold" />
            </div>
            <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t.appName}</span>
          </Link>
        </div>
      </motion.nav>

      {/* Main content */}
      <div className="relative flex min-h-screen items-center justify-center px-4 py-24">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          {/* Glassmorphism card */}
          <div className="relative overflow-hidden rounded-3xl border border-zinc-200/50 bg-white/80 p-8 shadow-xl backdrop-blur-xl dark:border-zinc-700/50 dark:bg-zinc-900/80 sm:p-10">
            {/* Subtle gradient overlay */}
            <div 
              className="pointer-events-none absolute inset-0 opacity-50"
              style={{
                background: `radial-gradient(600px circle at 100% 0%, ${ACCENT.glow || 'rgba(37, 99, 235, 0.1)'}, transparent 50%)`
              }}
            />
            
            <div className="relative">
              {/* Header */}
              <div className="text-center">
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {t.createAccount}
                </h1>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {t.registerSubtitle}
                </p>
              </div>

              {/* Success state */}
              {success ? (
                <motion.div
                  initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-8 flex flex-col items-center gap-4 text-center"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                    <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-zinc-700 dark:text-zinc-300">Account created successfully!</p>
                  <p className="text-sm text-zinc-500">Redirecting to your files...</p>
                </motion.div>
              ) : (
                <>
                  {/* Form */}
                  <form className="mt-8 space-y-5" onSubmit={onSubmit}>
                    {/* Name field */}
                    <div>
                      <label 
                        htmlFor="name" 
                        className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        {t.nameOptional}
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <User className="h-5 w-5 text-zinc-400" />
                        </div>
                        <input
                          id="name"
                          type="text"
                          autoComplete="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="block w-full rounded-xl border border-zinc-300 bg-white/50 py-3 pl-10 pr-4 text-zinc-900 placeholder-zinc-400 outline-none transition-all focus:border-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus:bg-zinc-800 dark:focus:ring-zinc-400/10"
                          placeholder="Your name"
                        />
                      </div>
                    </div>

                    {/* Email field */}
                    <div>
                      <label 
                        htmlFor="email" 
                        className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        {t.email}
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Envelope className="h-5 w-5 text-zinc-400" />
                        </div>
                        <input
                          id="email"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="block w-full rounded-xl border border-zinc-300 bg-white/50 py-3 pl-10 pr-4 text-zinc-900 placeholder-zinc-400 outline-none transition-all focus:border-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus:bg-zinc-800 dark:focus:ring-zinc-400/10"
                          placeholder="you@example.com"
                        />
                      </div>
                    </div>

                    {/* Password field */}
                    <div>
                      <label 
                        htmlFor="password" 
                        className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        {t.password}
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Lock className="h-5 w-5 text-zinc-400" />
                        </div>
                        <input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="block w-full rounded-xl border border-zinc-300 bg-white/50 py-3 pl-10 pr-12 text-zinc-900 placeholder-zinc-400 outline-none transition-all focus:border-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus:bg-zinc-800 dark:focus:ring-zinc-400/10"
                          placeholder="Create a password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeSlash className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                      
                      {/* Password strength indicator */}
                      {password && (
                        <motion.div
                          initial={reduce ? false : { opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-2"
                        >
                          <div className="h-1 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
                            <motion.div
                              initial={reduce ? false : { width: 0 }}
                              animate={{ width: passwordStrength === 'strong' ? '100%' : passwordStrength === 'medium' ? '66%' : '33%' }}
                              transition={{ duration: 0.3 }}
                              className={`h-full rounded-full ${strengthColor[passwordStrength]}`}
                            />
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">
                            {passwordStrength === 'strong' ? 'Strong password' : passwordStrength === 'medium' ? 'Good, but could be stronger' : 'Password must be at least 6 characters'}
                          </p>
                        </motion.div>
                      )}
                    </div>

                    {/* Error message */}
                    {error && (
                      <motion.div
                        initial={reduce ? false : { opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
                      >
                        {error}
                      </motion.div>
                    )}

                    {/* Submit button */}
                    <motion.button
                      type="submit"
                      disabled={pending}
                      whileHover={reduce ? undefined : { scale: 1.01 }}
                      whileTap={reduce ? undefined : { scale: 0.99 }}
                      className="group relative flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ backgroundColor: ACCENT.light }}
                    >
                      {pending ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          {t.creating}
                        </>
                      ) : (
                        <>
                          {t.createAccount}
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </motion.button>
                  </form>

                  {/* Divider */}
                  <div className="relative mt-8">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                        or
                      </span>
                    </div>
                  </div>

                  {/* Sign in link */}
                  <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
                    {t.hasAccount}{' '}
                    <Link 
                      to="/login" 
                      className="font-medium transition-colors hover:underline"
                      style={{ color: ACCENT.light }}
                    >
                      {t.signInLink}
                    </Link>
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Back link */}
          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-6 text-center"
          >
            <Link 
              to="/" 
              className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              Back to home
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}