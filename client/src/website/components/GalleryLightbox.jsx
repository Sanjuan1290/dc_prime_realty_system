import { useEffect, useState } from 'react'
import { FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi'

const GalleryLightbox = ({ images, initialIndex = 0, onClose }) => {
  const [index, setIndex] = useState(initialIndex)
  const current = images[index]

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') setIndex((value) => (value - 1 + images.length) % images.length)
      if (event.key === 'ArrowRight') setIndex((value) => (value + 1) % images.length)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKey)
    }
  }, [images.length, onClose])

  if (!current) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="Project image gallery">
      <button type="button" onClick={onClose} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20" aria-label="Close gallery"><FiX className="h-5 w-5" /></button>
      <button type="button" onClick={() => setIndex((value) => (value - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 sm:left-6" aria-label="Previous image"><FiChevronLeft className="h-6 w-6" /></button>
      <figure className="flex max-h-[90vh] max-w-[1180px] flex-col items-center">
        <img src={current.src} alt={current.alt} className="max-h-[78vh] max-w-full rounded-[14px] object-contain" />
        <figcaption className="mt-4 max-w-3xl text-center text-[12px] leading-5 text-white/80">{current.alt}<span className="ml-3 text-white/55">{index + 1} of {images.length}</span></figcaption>
      </figure>
      <button type="button" onClick={() => setIndex((value) => (value + 1) % images.length)} className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 sm:right-6" aria-label="Next image"><FiChevronRight className="h-6 w-6" /></button>
    </div>
  )
}

export default GalleryLightbox
