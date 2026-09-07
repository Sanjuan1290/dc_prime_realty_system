import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const REVEAL_SELECTOR = [
  '#main-content > section:not(:first-child)',
  '#main-content > article',
  '#main-content > div:not(:first-child)',
  '#main-content section article',
  '#main-content [data-reveal]',
].join(',')

const ScrollReveal = () => {
  const location = useLocation()

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    let observer
    let animationFrame
    let elements = []

    animationFrame = window.requestAnimationFrame(() => {
      elements = [...document.querySelectorAll(REVEAL_SELECTOR)].filter((element) => (
        !element.closest('[role="dialog"]') &&
        !element.closest('[aria-hidden="true"]') &&
        !element.classList.contains('website-scroll-reveal')
      ))

      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('website-scroll-reveal-visible')
          observer.unobserve(entry.target)
        })
      }, {
        threshold: 0.12,
        rootMargin: '0px 0px -8% 0px',
      })

      elements.forEach((element, index) => {
        element.classList.add('website-scroll-reveal')
        element.style.setProperty('--website-reveal-delay', `${Math.min(index % 4, 3) * 65}ms`)
        observer.observe(element)
      })
    })

    return () => {
      window.cancelAnimationFrame(animationFrame)
      observer?.disconnect()
      elements.forEach((element) => {
        element.classList.remove('website-scroll-reveal', 'website-scroll-reveal-visible')
        element.style.removeProperty('--website-reveal-delay')
      })
    }
  }, [location.pathname])

  return null
}

export default ScrollReveal
