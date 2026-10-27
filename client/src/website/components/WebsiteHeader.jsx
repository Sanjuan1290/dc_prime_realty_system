import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { FiArrowUpRight, FiMenu, FiX } from 'react-icons/fi'
import BrandLogo from './BrandLogo'
import { navigation } from '../data/staticSite'

export default function WebsiteHeader() {
  const [open,setOpen] = useState(false)
  const location=useLocation()
  useEffect(()=>setOpen(false),[location.pathname])
  return <header className="dc-header">
    <div className="dc-container dc-header-inner">
      <BrandLogo />
      <nav className={`dc-nav ${open?'dc-nav-open':''}`} aria-label="Main navigation" id="dc-primary-nav">
        {navigation.map(item=><NavLink key={item.to} to={item.to} end={item.to==='/' } className={({isActive})=>`dc-nav-link ${isActive?'dc-nav-active':''}`}>{item.title}</NavLink>)}
        <Link className="dc-nav-mobile-book" to="/book-tripping">Book a Tripping <FiArrowUpRight /></Link>
      </nav>
      <Link to="/book-tripping" className="dc-btn dc-btn-gold dc-header-book">Book a Tripping <FiArrowUpRight /></Link>
      <button type="button" aria-expanded={open} aria-controls="dc-primary-nav" aria-label={open?'Close navigation':'Open navigation'} className="dc-menu-toggle" onClick={()=>setOpen(!open)}>{open?<FiX/>:<FiMenu/>}</button>
    </div>
  </header>
}
