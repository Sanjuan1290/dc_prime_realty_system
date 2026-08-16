import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const SAVED_KEY = 'dc_prime_saved_projects'
const RECENT_KEY = 'dc_prime_recent_projects'

const readSlugs = (key) => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return []
  }
}

const ProjectPreferencesContext = createContext(null)

export const ProjectPreferencesProvider = ({ children }) => {
  const [savedSlugs, setSavedSlugs] = useState(() => readSlugs(SAVED_KEY))
  const [recentSlugs, setRecentSlugs] = useState(() => readSlugs(RECENT_KEY))

  useEffect(() => { window.localStorage.setItem(SAVED_KEY, JSON.stringify(savedSlugs)) }, [savedSlugs])
  useEffect(() => { window.localStorage.setItem(RECENT_KEY, JSON.stringify(recentSlugs)) }, [recentSlugs])

  useEffect(() => {
    const sync = (event) => {
      if (!event.key || event.key === SAVED_KEY) setSavedSlugs(readSlugs(SAVED_KEY))
      if (!event.key || event.key === RECENT_KEY) setRecentSlugs(readSlugs(RECENT_KEY))
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const isSaved = useCallback((slug) => savedSlugs.includes(slug), [savedSlugs])
  const toggleSaved = useCallback((slug) => setSavedSlugs((current) => current.includes(slug) ? current.filter((item) => item !== slug) : [slug, ...current]), [])
  const markRecentlyViewed = useCallback((slug) => setRecentSlugs((current) => [slug, ...current.filter((item) => item !== slug)].slice(0, 5)), [])
  const clearSaved = useCallback(() => setSavedSlugs([]), [])

  const value = useMemo(() => ({ savedSlugs, recentSlugs, isSaved, toggleSaved, markRecentlyViewed, clearSaved }), [savedSlugs, recentSlugs, isSaved, toggleSaved, markRecentlyViewed, clearSaved])

  return <ProjectPreferencesContext.Provider value={value}>{children}</ProjectPreferencesContext.Provider>
}

export const useProjectPreferences = () => {
  const context = useContext(ProjectPreferencesContext)
  if (!context) throw new Error('useProjectPreferences must be used inside ProjectPreferencesProvider')
  return context
}
