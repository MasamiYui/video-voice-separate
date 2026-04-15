import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  AudioLines,
  ChevronDown,
  Clapperboard,
  Cpu,
  Languages,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  Mic,
  Music,
  PlusCircle,
  ScanSearch,
  Settings,
  Wrench,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useI18n } from '../../i18n/useI18n'

function normalizePathname(pathname: string) {
  if (pathname === '/') return pathname
  return pathname.replace(/\/+$/, '')
}

export function Sidebar() {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const currentPath = normalizePathname(pathname)
  const isNewTaskRoute = currentPath === '/tasks/new' || currentPath.startsWith('/tasks/new/')
  const isToolsRoute = currentPath === '/tools' || currentPath.startsWith('/tools/')
  const [toolsExpanded, setToolsExpanded] = useState(isToolsRoute)

  useEffect(() => {
    if (isToolsRoute) {
      setToolsExpanded(true)
    }
  }, [isToolsRoute])

  const navItems = [
    {
      to: '/',
      label: t.nav.dashboard,
      icon: LayoutDashboard,
      isActive: currentPath === '/',
    },
    {
      to: '/tasks',
      label: t.nav.tasks,
      icon: ListChecks,
      isActive:
        currentPath === '/tasks' || (currentPath.startsWith('/tasks/') && !isNewTaskRoute),
    },
    {
      to: '/tasks/new',
      label: t.nav.newTask,
      icon: PlusCircle,
      isActive: isNewTaskRoute,
    },
    {
      to: '/settings',
      label: t.nav.settings,
      icon: Settings,
      isActive: currentPath === '/settings',
    },
  ]

  const toolNavItems = [
    { to: '/tools/separation', label: t.atomicTools.tools.separation, icon: AudioLines },
    { to: '/tools/mixing', label: t.atomicTools.tools.mixing, icon: Music },
    { to: '/tools/transcription', label: t.atomicTools.tools.transcription, icon: MessageSquareText },
    { to: '/tools/translation', label: t.atomicTools.tools.translation, icon: Languages },
    { to: '/tools/tts', label: t.atomicTools.tools.tts, icon: Mic },
    { to: '/tools/probe', label: t.atomicTools.tools.probe, icon: ScanSearch },
    { to: '/tools/muxing', label: t.atomicTools.tools.muxing, icon: Clapperboard },
  ]

  return (
    <aside className="fixed left-0 top-0 h-full w-[220px] bg-slate-900 flex flex-col z-40">
      {/* Logo area */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
          <Cpu size={16} className="text-white" />
        </div>
        <div>
          <div className="text-white font-semibold text-sm leading-tight">Translip</div>
          <div className="text-slate-400 text-xs leading-tight">{t.nav.subtitle}</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon, isActive }) => (
          <Link
            key={to}
            to={to}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}

        <button
          type="button"
          onClick={() => {
            setToolsExpanded(prev => !prev)
            navigate('/tools')
          }}
          className={cn(
            'flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            isToolsRoute
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
          )}
        >
          <Wrench size={16} />
          {t.atomicTools.title}
          <ChevronDown
            size={14}
            className={cn('ml-auto transition-transform', toolsExpanded && 'rotate-180')}
          />
        </button>

        {toolsExpanded && (
          <div className="ml-4 space-y-1 border-l border-slate-800 pl-3">
            {toolNavItems.map(({ to, label, icon: Icon }) => {
              const isActive = currentPath === to
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-slate-800 text-slate-50'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
                  )}
                >
                  <Icon size={14} />
                  {label}
                </Link>
              )
            })}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-800">
        <div className="text-slate-500 text-xs">v0.1.0</div>
      </div>
    </aside>
  )
}
