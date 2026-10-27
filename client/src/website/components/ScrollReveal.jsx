import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollReveal(){
 const { pathname } = useLocation()
 useEffect(()=>{
  if(!('IntersectionObserver' in window) || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const els=[...document.querySelectorAll('#main-content .dc-project-tile, #main-content .dc-blog-tile, #main-content .dc-values-grid article, #main-content .dc-points-grid article, #main-content .dc-information-grid article')]
  const observer=new IntersectionObserver(entries=>{
   entries.forEach(entry=>{
    if(!entry.isIntersecting)return
    entry.target.classList.add('dc-revealed')
    observer.unobserve(entry.target)
   })
  },{threshold:0.08,rootMargin:'0px 0px -24px 0px'})
  els.forEach(el=>{el.classList.add('dc-reveal-ready');observer.observe(el)})
  return ()=>{observer.disconnect();els.forEach(el=>el.classList.remove('dc-reveal-ready','dc-revealed'))}
 },[pathname])
 return null
}
