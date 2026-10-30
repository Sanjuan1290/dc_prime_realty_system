import { useEffect, useRef, useState } from 'react'
import { FiPause, FiPlay } from 'react-icons/fi'

/** Decorative footage only: the text and project details remain accessible without video. */
export default function HeroBackgroundVideo({ poster, src }) {
  const videoRef = useRef(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const mobile = window.matchMedia('(max-width: 670px)')
    // Reduced motion, small screens, and data-saver start with the poster image.
    // Visitors can still choose Play themselves.
    const canAutoPlay = () => !reducedMotion.matches && !mobile.matches && !navigator.connection?.saveData
    const stop = () => { video.pause(); setPlaying(false) }
    const tryAutoPlay = () => {
      if (!canAutoPlay() || document.hidden) return
      video.muted = true
      const attempt = video.play()
      if (attempt?.catch) attempt.catch(() => setPlaying(false))
    }
    const onVisibility = () => { if (document.hidden) stop() }
    const onPreferenceChange = () => stop()
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) stop() }, { threshold: 0.02 })
      : null
    observer?.observe(video)

    tryAutoPlay()
    document.addEventListener('visibilitychange', onVisibility)
    reducedMotion.addEventListener?.('change', onPreferenceChange)
    mobile.addEventListener?.('change', onPreferenceChange)
    return () => {
      observer?.disconnect()
      video.pause()
      document.removeEventListener('visibilitychange', onVisibility)
      reducedMotion.removeEventListener?.('change', onPreferenceChange)
      mobile.removeEventListener?.('change', onPreferenceChange)
    }
  }, [src])

  const togglePlayback = async () => {
    const video = videoRef.current
    if (!video) return
    if (!video.paused) { video.pause(); setPlaying(false); return }
    try {
      video.muted = true
      await video.play()
      setPlaying(true)
    } catch { setPlaying(false) }
  }

  return <>
    <img className="dc-hero-media" src={poster} alt="Aerial landscape from D&C Prime Realty's Prime Enclave media collection in Maragondon, Cavite" fetchPriority="high" loading="eager" decoding="async" width="1648" height="928" />
    <video
      ref={videoRef}
      className={`dc-hero-video ${playing ? 'dc-hero-video-active' : ''}`}
      src={src}
      poster={poster}
      muted
      playsInline
      loop
      preload="none"
      disablePictureInPicture
      aria-hidden="true"
      tabIndex={-1}
      onPlaying={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onError={() => setPlaying(false)}
    />
    <button
      type="button"
      className="dc-hero-playback"
      onClick={togglePlayback}
      aria-label={playing ? 'Pause background video' : 'Play background video'}
      aria-pressed={playing}
      title={playing ? 'Pause footage' : 'Play footage'}
    >
      {playing ? <FiPause aria-hidden="true" /> : <FiPlay aria-hidden="true" />}
      <span>{playing ? 'Pause footage' : 'Play footage'}</span>
    </button>
  </>
}

