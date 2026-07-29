import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import WebsiteHeader from '../components/WebsiteHeader'
import WebsiteFooter from '../components/WebsiteFooter'

const WebsiteLayout = () => {
  const location = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }) }, [location.pathname])

  return (
    <div className="website-shell min-h-screen bg-[#fbfaf6] text-[#282216]">
      <WebsiteHeader />
      <main><Outlet /></main>
      <WebsiteFooter />
    </div>
  )
}

export default WebsiteLayout
