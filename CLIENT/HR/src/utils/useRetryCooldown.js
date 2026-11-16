import { useCallback, useEffect, useState } from 'react'

export default function useRetryCooldown(error) {
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(Date.now)
  const delayRetry = useCallback((failure) => {
    const seconds = Number(failure?.retryAfterSeconds || 0)
    if (Number.isFinite(seconds) && seconds > 0) {
      setUntil(previous => Math.max(previous, Date.now() + Math.min(seconds, 3600) * 1000))
    }
  }, [])
  useEffect(() => { delayRetry(error) }, [error, delayRetry])
  useEffect(() => {
    setNow(Date.now())
    if (until <= Date.now()) return
    const timer = setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= until) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [until])
  return { retrySeconds: Math.max(0, Math.ceil((until - now) / 1000)), delayRetry }
}
