import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import WebsiteHeader from '../components/WebsiteHeader'
import WebsiteFooter from '../components/WebsiteFooter'
import MobileActionBar from '../components/MobileActionBar'
import { ProjectPreferencesProvider } from '../context/ProjectPreferencesContext'

const WebsiteLayout = () => {
  const location = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }) }, [location.pathname])

  return (
    <ProjectPreferencesProvider>
      <div className="website-shell min-h-screen bg-[#f8f6f0] text-[#302e29]">
        <a href="#main-content" className="sr-only z-[100] rounded-lg bg-white px-4 py-3 text-[#17130a] focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to main content</a>
        <WebsiteHeader />
        <main id="main-content"><Outlet /></main>
        <WebsiteFooter />
        <MobileActionBar />
      </div>
    </ProjectPreferencesProvider>
  )
}

export default WebsiteLayout
