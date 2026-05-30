import { Link } from 'react-router-dom'
import { useI18n } from '@smart-files/shared/src/i18n'
import { motion, useReducedMotion } from 'motion/react'
import { CloudArrowUp, Folder, ShareNetwork, ArrowsClockwise, Shield, HardDrives } from '@phosphor-icons/react'

// Accent color: Cobalt blue - avoiding AI-purple and beige+brass traps
const ACCENT = {
  light: '#2563eb',
  dark: '#3b82f6',
  glow: 'rgba(37, 99, 235, 0.15)'
}

function FeatureCard({ 
  icon: Icon, 
  title, 
  description, 
  className = '',
  delay = 0 
}: { 
  icon: React.ComponentType<{ className?: string; weight?: 'regular' | 'bold' | 'thin' | 'light' | 'fill' | 'duotone' }>
  title: string
  description: string
  className?: string
  delay?: number
}) {
  const reduce = useReducedMotion()
  
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={reduce ? undefined : { y: -4, transition: { duration: 0.2 } }}
      className={`group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      <div 
        className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${ACCENT.glow}, transparent 40%)` }}
      />
      <div className="relative">
        <div className="mb-4 inline-flex rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800">
          <Icon className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />
        </div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{description}</p>
      </div>
    </motion.div>
  )
}

function AnimatedButton({ 
  to, 
  children, 
  variant = 'primary',
  className = ''
}: { 
  to: string
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  className?: string
}) {
  const reduce = useReducedMotion()
  const isPrimary = variant === 'primary'
  
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
  )
}

export function HomePage() {
  const { t } = useI18n()
  const reduce = useReducedMotion()

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950" style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>
      {/* Navigation */}
      <motion.nav
        initial={reduce ? false : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="fixed left-0 right-0 top-0 z-50 border-b border-zinc-200/50 bg-white/80 backdrop-blur-md dark:border-zinc-800/50 dark:bg-zinc-950/80"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div 
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: ACCENT.light }}
            >
              <CloudArrowUp className="h-5 w-5 text-white" weight="bold" />
            </div>
            <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t.appName}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              to="/login" 
              className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {t.signIn}
            </Link>
            <AnimatedButton to="/register" className="px-4 py-2">
              {t.register}
            </AnimatedButton>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section - Asymmetric Split */}
      <section className="relative min-h-screen pt-16">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl grid-cols-1 items-center gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          {/* Left: Content */}
          <motion.div
            initial={reduce ? false : { opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col justify-center py-12 lg:py-0"
          >
            <div 
              className="mb-6 inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
              style={{ backgroundColor: `${ACCENT.light}15`, color: ACCENT.light }}
            >
              <span className="relative flex h-2 w-2">
                <span 
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                  style={{ backgroundColor: ACCENT.light }}
                />
                <span 
                  className="relative inline-flex h-2 w-2 rounded-full"
                  style={{ backgroundColor: ACCENT.light }}
                />
              </span>
              Free for personal use
            </div>
            
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl lg:text-6xl">
              File storage
              <br />
              <span style={{ color: ACCENT.light }}>without limits</span>
            </h1>
            
            <p className="mt-6 max-w-md text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
              Upload gigabytes with confidence. Pause and resume anytime. Your files, your folders, your rules.
            </p>
            
            <div className="mt-8 flex flex-wrap gap-3">
              <AnimatedButton to="/register">
                Start uploading free
              </AnimatedButton>
              <AnimatedButton to="/login" variant="secondary">
                Sign in
              </AnimatedButton>
            </div>
            
            <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-500">
              No credit card required. 10GB free tier.
            </p>
          </motion.div>
          
          {/* Right: Visual */}
          <motion.div
            initial={reduce ? false : { opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex items-center justify-center lg:justify-end"
          >
            <div className="relative w-full max-w-lg">
              {/* Main image */}
              <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
                <img
                  src="https://picsum.photos/seed/smartfiles-interface/800/600"
                  alt="Smart Files interface showing folder management"
                  className="h-auto w-full"
                  loading="eager"
                />
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/20 to-transparent" />
              </div>
              
              {/* Floating element: Upload progress */}
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="absolute -bottom-6 -left-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${ACCENT.light}15` }}
                  >
                    <ArrowsClockwise className="h-5 w-5 animate-spin" style={{ color: ACCENT.light }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Uploading...</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">design-assets.zip (67%)</p>
                  </div>
                </div>
              </motion.div>
              
              {/* Floating element: Shared file */}
              <motion.div
                initial={reduce ? false : { opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1, ease: [0.16, 1, 0.3, 1] }}
                className="absolute -right-4 top-12 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <ShareNetwork className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Shared link created</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trusted by section */}
      <section className="border-y border-zinc-200 bg-zinc-50/50 py-12 dark:border-zinc-800 dark:bg-zinc-900/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="mb-8 text-center text-sm font-medium text-zinc-500 dark:text-zinc-500">
            Trusted by teams at
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-60 grayscale dark:opacity-40">
            {/* Using simple text logos as placeholders - real SVG logos would be better */}
            {['Vercel', 'Stripe', 'Linear', 'Notion', 'Figma'].map((name) => (
              <span key={name} className="text-lg font-semibold text-zinc-700 dark:text-zinc-400">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mb-16 text-center"
          >
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
              Built for real workflows
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
              Everything you need to manage files at scale. No compromises.
            </p>
          </motion.div>
          
          {/* Bento Grid - asymmetric layout */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
            {/* Large card: Chunked uploads */}
            <FeatureCard
              icon={ArrowsClockUp}
              title="Pause and resume uploads"
              description="Life happens. Pause an upload, close your laptop, and resume hours later right where you left off."
              className="sm:col-span-2 lg:col-span-2 lg:row-span-1"
              delay={0}
            />
            
            {/* Standard card: Folders */}
            <FeatureCard
              icon={Folder}
              title="Organized folders"
              description="Create nested folders. Move files between them. Keep your workspace tidy."
              delay={0.1}
            />
            
            {/* Standard card: Sharing */}
            <FeatureCard
              icon={ShareNetwork}
              title="Password-protected sharing"
              description="Generate share links with optional passwords and expiration dates."
              delay={0.2}
            />
            
            {/* Standard card: Security */}
            <FeatureCard
              icon={Shield}
              title="Private by default"
              description="Your files are yours alone. No scanning, no AI training, no surprises."
              delay={0.3}
            />
            
            {/* Wide card: Storage */}
            <FeatureCard
              icon={HardDrives}
              title="10GB free, then pay as you grow"
              description="Start free. Upgrade when you need more. Simple, predictable pricing."
              className="lg:col-span-2"
              delay={0.4}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden py-24">
        <div 
          className="absolute inset-0"
          style={{ backgroundColor: ACCENT.light }}
        />
        <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/smartfiles-cta/1920/1080')] bg-cover bg-center opacity-10 mix-blend-overlay" />
        
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Ready to upload?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
              Join thousands of users who have already uploaded millions of files.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <motion.div
                whileHover={reduce ? undefined : { scale: 1.02 }}
                whileTap={reduce ? undefined : { scale: 0.98 }}
              >
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-medium transition-colors hover:bg-zinc-100"
                  style={{ color: ACCENT.light }}
                >
                  Create free account
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-zinc-50 py-12 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div 
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: ACCENT.light }}
              >
                <CloudArrowUp className="h-5 w-5 text-white" weight="bold" />
              </div>
              <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t.appName}</span>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
              {new Date().getFullYear()} {t.appName}. Built for reliability.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Re-export with correct icon name
function ArrowsClockUp(props: { className?: string; weight?: 'regular' | 'bold' | 'thin' | 'light' | 'fill' | 'duotone' }) {
  return <ArrowsClockwise {...props} />
}