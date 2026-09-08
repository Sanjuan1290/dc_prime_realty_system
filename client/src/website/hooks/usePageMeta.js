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

const usePageMeta = ({ title, description, image = '/website/images/bailen/luntiang-aguinaldo-cover.jpg', type = 'website', schema = null }) => {
  useEffect(() => {
    const pageTitle = title || 'D&C Prime Realty'
    const pageUrl = `${window.location.origin}${window.location.pathname}`
    const imageUrl = new URL(image, window.location.origin).href

    document.title = pageTitle
    getOrCreateMeta('description').setAttribute('content', description || '')
    getOrCreateMeta('og:title', 'property').setAttribute('content', pageTitle)
    getOrCreateMeta('og:description', 'property').setAttribute('content', description || '')
    getOrCreateMeta('og:type', 'property').setAttribute('content', type)
    getOrCreateMeta('og:image', 'property').setAttribute('content', imageUrl)
    getOrCreateMeta('og:url', 'property').setAttribute('content', pageUrl)
    getOrCreateMeta('twitter:card').setAttribute('content', 'summary_large_image')

    let canonical = document.head.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', pageUrl)

    const schemaId = 'website-page-schema'
    document.getElementById(schemaId)?.remove()
    if (schema) {
      const script = document.createElement('script')
      script.id = schemaId
      script.type = 'application/ld+json'
      script.textContent = JSON.stringify(schema)
      document.head.appendChild(script)
    }

    return () => document.getElementById(schemaId)?.remove()
  }, [title, description, image, type, schema])
}

export default usePageMeta

