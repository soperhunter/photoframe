import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/',      label: 'Slideshow', icon: '▶' },
  { to: '/map',   label: 'Map',       icon: '◎' },
  { to: '/admin', label: 'Manage',    icon: '⚙' },
]

export default function NavBar() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-[9999] flex bg-bg-deep/95 backdrop-blur border-t border-bg-cream/10">
      {TABS.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors select-none
            ${isActive ? 'text-accent-honey' : 'text-text-ivory/40 hover:text-text-ivory/70'}`
          }
        >
          <span className="text-xl leading-none">{icon}</span>
          <span className="font-inter text-xs tracking-wide">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
