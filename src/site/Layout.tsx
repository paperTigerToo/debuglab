import { Link, NavLink, Outlet } from 'react-router'
import { areas } from './areas'
import { TermDescriptions } from './Term'
import { useTheme } from './theme'

export function Layout() {
  const { theme, toggle } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="font-mono text-sm font-semibold tracking-tight">
            <span className="text-accent">$</span> debuglab
          </Link>
          <nav aria-label="Main" className="order-3 w-full sm:order-none sm:w-auto">
            <ul className="flex flex-wrap gap-1">
              {areas.map((area) => (
                <li key={area.path}>
                  <NavLink
                    to={area.path}
                    className={({ isActive }) =>
                      `block rounded px-3 py-1.5 text-sm transition-colors ${
                        isActive ? 'bg-panel-2 text-text' : 'text-muted hover:text-text'
                      }`
                    }
                  >
                    {area.name}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <button
            type="button"
            onClick={toggle}
            aria-label={`Switch to ${next} theme`}
            className="ml-auto rounded border border-line px-3 py-1.5 font-mono text-xs text-muted hover:text-text"
          >
            {theme === 'dark' ? '☾ dark' : '☀ light'}
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <TermDescriptions />
      <footer className="border-t border-line px-4 py-4 text-center text-xs text-muted">
        DebugLab: practise debugging a live service without a live service.
      </footer>
    </div>
  )
}
