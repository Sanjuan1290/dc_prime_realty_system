import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import WebsiteHeader from '../components/WebsiteHeader'
import WebsiteFooter from '../components/WebsiteFooter'

export default function WebsiteLayout(){
 const location=useLocation()
 useEffect(()=>{
  if(location.hash){ const el=document.getElementById(location.hash.slice(1)); el?.scrollIntoView({behavior:'smooth'}); }
  else window.scrollTo({top:0,behavior:'instant'})
 },[location.pathname,location.hash])
 return <div className="website-shell">
  <a href="#main-content" className="dc-skip">Skip to content</a>
  <WebsiteHeader />
  <main id="main-content"><Outlet /></main>
  <WebsiteFooter />
 </div>
}
