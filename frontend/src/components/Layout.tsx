import { NavLink, Outlet } from 'react-router-dom'

const staticLinkClass =
  'inline-flex min-h-9 items-center whitespace-nowrap rounded-sm border border-transparent px-3 py-1.5 text-sm font-medium text-[#93a19a] transition-colors hover:border-[#26302d] hover:bg-[#121716] hover:text-[#eef2ef]'

export default function Layout() {
  return (
    <div className="app-shell min-h-screen bg-[#0b0f0e] text-[#eef2ef]">
      <header className="app-header border-b border-[#26302d] bg-[#0b0f0e]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center border border-[#57b79e] font-mono text-[11px] text-[#57b79e]">
              LG
            </div>
            <div>
              <p className="text-sm font-medium leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                LandGuard AI
              </p>
              <p className="text-xs leading-tight text-[#93a19a]">Landslide early warning — NER</p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center justify-end gap-1">
            <a className={staticLinkClass} href="/">
              Home
            </a>
            <NavLink
              to="/alerts.html"
              className={({ isActive }) =>
                `inline-flex min-h-9 items-center whitespace-nowrap rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-[#57b79e] bg-[#57b79e] text-[#08110d]'
                    : 'border-transparent text-[#93a19a] hover:border-[#26302d] hover:bg-[#121716] hover:text-[#eef2ef]'
                }`
              }
            >
              Alerts
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}