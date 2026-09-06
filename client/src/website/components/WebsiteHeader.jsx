import { useEffect, useState } from 'react'
import { FiCalendar, FiChevronDown, FiHeart, FiMenu, FiSearch, FiX } from 'react-icons/fi'
import { Link, NavLink, useLocation } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import NavigationDropdown from './NavigationDropdown'
import SiteSearch from './SiteSearch'
import { siteNavigation } from '../data/company'
import { useProjectPreferences } from '../context/ProjectPreferencesContext'

const getDirectNavClass = (light) => ({ isActive }) => {
  if (light) return `relative rounded-md px-2 py-3 text-[13px] font-semibold transition ${isActive ? 'text-[#f0cf70]' : 'text-white/90 hover:text-[#f0cf70]'}`
  return `relative rounded-md px-2 py-3 text-[13px] font-semibold transition ${isActive ? 'text-[#806014]' : 'text-[#322e27] hover:text-[#806014]'}`
}

const WebsiteHeader = () => {
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileGroups, setMobileGroups] = useState({})
  const [overVideoHero, setOverVideoHero] = useState(false)
  const location = useLocation()
  const { savedSlugs } = useProjectPreferences()
  const isHome = location.pathname === '/'
  const transparentHeader = isHome && overVideoHero && !open

  useEffect(() => {
    setOpen(false)
    setSearchOpen(false)
    setMobileGroups({})
  }, [location.pathname])

  useEffect(() => {
    if (!isHome) { setOverVideoHero(false); return undefined }
    const updateHeaderAppearance = () => {
      const hero = document.getElementById('home-video-hero')
      if (!hero) { setOverVideoHero(window.scrollY < 120); return }
      const headerHeight = 68
      const bounds = hero.getBoundingClientRect()
      setOverVideoHero(bounds.top <= headerHeight && bounds.bottom > headerHeight)
    }
    updateHeaderAppearance()
    const animationFrame = window.requestAnimationFrame(updateHeaderAppearance)
    const delayedCheck = window.setTimeout(updateHeaderAppearance, 120)
    window.addEventListener('scroll', updateHeaderAppearance, { passive: true })
    window.addEventListener('resize', updateHeaderAppearance)
    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.clearTimeout(delayedCheck)
      window.removeEventListener('scroll', updateHeaderAppearance)
      window.removeEventListener('resize', updateHeaderAppearance)
    }
  }, [isHome, location.pathname])

  const iconButtonClass = transparentHeader
    ? 'border-white/35 bg-black/15 text-white backdrop-blur hover:bg-black/25'
    : 'border-[#ded9ce] bg-white text-[#292722] hover:bg-[#f8f6f0]'

  return (
    <>
      <header className={`${isHome ? 'fixed left-0 right-0' : 'sticky'} top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-300 ${transparentHeader ? 'border-transparent bg-transparent shadow-none' : 'border-[#e4ded3] bg-white/95 shadow-[0_5px_24px_rgba(35,29,18,0.05)] backdrop-blur'}`}>
        <div className="mx-auto flex min-h-[68px] max-w-[1280px] items-center justify-between gap-4 px-5 lg:px-8">
          <BrandLogo compact light={transparentHeader} />

          <nav className="hidden items-center gap-1 xl:flex" aria-label="Primary navigation">
            {siteNavigation.map((item) => item.children ? <NavigationDropdown key={item.label} item={item} light={transparentHeader} /> : <NavLink key={item.to} to={item.to} end={item.to === '/'} className={getDirectNavClass(transparentHeader)}>{item.label}</NavLink>)}
          </nav>

          <div className="hidden items-center gap-2 xl:flex">
            <button type="button" onClick={() => setSearchOpen(true)} className={`flex h-10 w-10 items-center justify-center rounded-lg border transition ${iconButtonClass}`} aria-label="Search website"><FiSearch /></button>
            <Link to="/saved-projects" className={`relative flex h-10 w-10 items-center justify-center rounded-lg border transition ${iconButtonClass}`} aria-label={`Saved projects: ${savedSlugs.length}`}><FiHeart />{savedSlugs.length ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d4aa3b] px-1 text-[9px] font-bold text-[#17130a]">{savedSlugs.length}</span> : null}</Link>
            <Link to="/properties#book-tripping" className={transparentHeader ? 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] bg-[#d8b451] px-5 text-[13px] font-bold text-[#17130a] transition hover:bg-[#e6c66f] focus:outline-none focus:ring-4 focus:ring-white/20' : 'website-button-dark'}><FiCalendar /> Book a Tripping</Link>
          </div>

          <div className="flex items-center gap-2 xl:hidden">
            <button type="button" onClick={() => setSearchOpen(true)} className={`flex h-10 w-10 items-center justify-center rounded-lg border transition ${iconButtonClass}`} aria-label="Search website"><FiSearch /></button>
            <button type="button" onClick={() => setOpen((value) => !value)} className={`flex h-10 w-10 items-center justify-center rounded-lg border transition ${iconButtonClass}`} aria-expanded={open} aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}>{open ? <FiX className="h-5 w-5" /> : <FiMenu className="h-5 w-5" />}</button>
          </div>
        </div>

        {open ? (
          <div className="border-t border-[#e7e1d7] bg-white px-5 pb-6 pt-3 shadow-lg xl:hidden">
            <nav className="mx-auto grid max-w-[1280px] gap-1" aria-label="Mobile navigation">
              {siteNavigation.map((item) => item.children ? (
                <div key={item.label} className="border-b border-[#eee9e1] py-1">
                  <button type="button" onClick={() => setMobileGroups((current) => ({ ...current, [item.label]: !current[item.label] }))} className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-[14px] font-semibold text-[#302d27] hover:bg-[#f8f6f0]" aria-expanded={Boolean(mobileGroups[item.label])}>{item.label}<FiChevronDown className={`h-4 w-4 transition ${mobileGroups[item.label] ? 'rotate-180' : ''}`} /></button>
                  {mobileGroups[item.label] ? <div className="ml-3 grid gap-1 border-l border-[#ded9ce] pl-3">{item.children.map((child) => <NavLink key={child.to} to={child.to} className={({ isActive }) => `rounded-lg px-3 py-2.5 text-[13px] ${isActive ? 'bg-[#f5eedb] font-semibold text-[#806014]' : 'text-[#605b52] hover:bg-[#f8f6f0]'}`}>{child.label}</NavLink>)}</div> : null}
                </div>
              ) : <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `rounded-lg px-3 py-3 text-[14px] font-semibold ${isActive ? 'bg-[#f5eedb] text-[#806014]' : 'text-[#302d27] hover:bg-[#f8f6f0]'}`}>{item.label}</NavLink>)}
              <Link to="/saved-projects" className="mt-2 inline-flex items-center gap-2 rounded-lg px-3 py-3 text-[14px] font-semibold text-[#302d27] hover:bg-[#f8f6f0]"><FiHeart /> Saved Projects {savedSlugs.length ? `(${savedSlugs.length})` : ''}</Link>
              <Link to="/properties#book-tripping" className="website-button-dark mt-3"><FiCalendar /> Book a Tripping</Link>
            </nav>
          </div>
        ) : null}
      </header>
      <SiteSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}

export default WebsiteHeader

