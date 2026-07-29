import { useEffect, useState } from 'react'
import { FiCalendar, FiMenu, FiX } from 'react-icons/fi'
import { Link, NavLink, useLocation } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import { siteNavigation } from '../data/company'

const navClass = ({ isActive }) => `group relative whitespace-nowrap px-1 py-3 text-[13px] font-bold transition ${isActive ? 'text-[#a97908]' : 'text-[#312b1d] hover:text-[#a97908]'}`

const WebsiteHeader = () => {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setOpen(false), [location.pathname])

  return (
    <header className="sticky top-0 z-50 border-b border-[#e9dfc6] bg-white/95 shadow-[0_8px_30px_rgba(70,53,14,0.06)] backdrop-blur">
      <div className="mx-auto flex min-h-[76px] max-w-[1440px] items-center justify-between gap-6 px-5 lg:px-8">
        <BrandLogo compact />

        <nav className="hidden items-center gap-4 xl:flex" aria-label="Primary navigation">
          {siteNavigation.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navClass}>
              {({ isActive }) => (
                <>
                  {item.label}
                  <span className={`absolute inset-x-1 bottom-1 h-0.5 rounded-full bg-[#c79216] transition ${isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 xl:flex">
          <Link to="/properties#book-tripping" className="inline-flex h-11 items-center gap-2 rounded-full bg-[#17130a] px-5 text-[13px] font-black text-white transition hover:bg-[#a97908] focus:outline-none focus:ring-4 focus:ring-[#f2dd9c]">
            <FiCalendar aria-hidden="true" />
            Book a Tripping
          </Link>
        </div>

        <button type="button" onClick={() => setOpen((value) => !value)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#e1d4b5] text-[#241f14] xl:hidden" aria-expanded={open} aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}>
          {open ? <FiX className="h-6 w-6" /> : <FiMenu className="h-6 w-6" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-[#eee5d1] bg-white px-5 pb-6 pt-3 xl:hidden">
          <nav className="mx-auto grid max-w-[1440px] gap-1" aria-label="Mobile navigation">
            {siteNavigation.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `rounded-xl px-4 py-3 text-[15px] font-bold ${isActive ? 'bg-[#fff4cf] text-[#8a6200]' : 'text-[#30291b] hover:bg-[#faf6eb]'}`}>
                {item.label}
              </NavLink>
            ))}
            <Link to="/properties#book-tripping" className="mt-3 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#17130a] px-5 text-[14px] font-black text-white">
              <FiCalendar /> Book a Tripping
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  )
}

export default WebsiteHeader
