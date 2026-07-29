import { useEffect } from 'react'

const getOrCreateMeta = (name, attribute = 'name') => {
  let element = document.head.querySelector(`meta[${attribute}="${name}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, name)
    document.head.appendChild(element)
  }
  return element
}

const usePageMeta = ({ title, description, image = '/website/images/bailen/luntiang-aguinaldo-cover.jpg', type = 'website' }) => {
  useEffect(() => {
    const pageTitle = title ? `${title}` : 'D&C Prime Realty'
    document.title = pageTitle

    getOrCreateMeta('description').setAttribute('content', description || '')
    getOrCreateMeta('og:title', 'property').setAttribute('content', pageTitle)
    getOrCreateMeta('og:description', 'property').setAttribute('content', description || '')
    getOrCreateMeta('og:type', 'property').setAttribute('content', type)
    getOrCreateMeta('og:image', 'property').setAttribute('content', new URL(image, window.location.origin).href)
    getOrCreateMeta('twitter:card').setAttribute('content', 'summary_large_image')

    let canonical = document.head.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', `${window.location.origin}${window.location.pathname}`)
  }, [title, description, image, type])
}

export default usePageMeta
