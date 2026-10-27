import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import WebsiteHeader from '../components/WebsiteHeader'
import WebsiteFooter from '../components/WebsiteFooter'
import MobileBookingBar from '../components/MobileBookingBar'
import ScrollReveal from '../components/ScrollReveal'

export default function WebsiteLayout(){
 const location=useLocation()
 useEffect(()=>{
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if(location.hash){ const el=document.getElementById(location.hash.slice(1)); el?.scrollIntoView({behavior:reduced?'auto':'smooth'}); }
  else window.scrollTo({top:0,behavior:'instant'})
 },[location.pathname,location.hash])
 return <div className="website-shell">
  <a href="#main-content" className="dc-skip">Skip to content</a>
  <WebsiteHeader />
  <ScrollReveal />
  <main id="main-content"><Outlet /></main>
  <WebsiteFooter />
  <MobileBookingBar />
 </div>
}
