import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, ListChecks, PlusCircle, Settings, Cpu } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useI18n } from '../../i18n/useI18n'

function normalizePathname(pathname: string) {
  if (pathname === '/') return pathname
  return pathname.replace(/\/+$/, '')
}

export function Sidebar() {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const currentPath = normalizePathname(pathname)
  const isNewTaskRoute = currentPath === '/tasks/new' || currentPath.startsWith('/tasks/new/')

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
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-800">
        <div className="text-slate-500 text-xs">v0.1.0</div>
      </div>
    </aside>
  )
}
