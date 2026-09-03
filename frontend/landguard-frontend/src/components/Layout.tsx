import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/dashboard.html', label: 'Dashboard', end: true },
  { to: '/alerts.html', label: 'Alerts' },
]

export default function Layout() {
  return (
    <div className="app-shell min-h-screen bg-neutral-50 text-neutral-900">
      <header className="app-header border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-900 text-sm font-medium text-white">
              LG
            </div>
            <div>
              <p className="text-sm font-medium leading-tight">LANDGUARD AI</p>
              <p className="text-xs leading-tight text-neutral-500">Landslide early warning — NER</p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <a className="about-link" href="/about.html">About ↗</a>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
