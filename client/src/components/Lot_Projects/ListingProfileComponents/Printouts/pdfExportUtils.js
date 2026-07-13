const HTML2PDF_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'

let html2PdfPromise = null

export const sanitizePdfFileName = (value = 'printout') => {
  const cleaned = String(value || 'printout')
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return cleaned || 'printout'
}

const waitForNextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

const waitForImages = async (container) => {
  const images = Array.from(container?.querySelectorAll?.('img') || [])

  await Promise.all(
    images.map((image) => {
      if (image.complete && image.naturalWidth > 0) return Promise.resolve()

      return new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true })
        image.addEventListener('error', resolve, { once: true })
      })
    })
  )
}

const getPageSettings = (options = {}) => {
  const orientation = options.orientation || 'portrait'
  const format = options.format || 'a4'
  const isLandscape = orientation === 'landscape'

  if (format === 'legal') {
    return {
      format,
      orientation,
      widthPx: isLandscape ? 1344 : 816,
      minHeightPx: isLandscape ? 816 : 1344,
    }
  }

  return {
    format,
    orientation,
    widthPx: isLandscape ? 1123 : 794,
    minHeightPx: isLandscape ? 794 : 1123,
  }
}

export const loadHtml2Pdf = () => {
  if (window.html2pdf) return Promise.resolve(window.html2pdf)

  if (!html2PdfPromise) {
    html2PdfPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${HTML2PDF_CDN_URL}"]`)

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.html2pdf), { once: true })
        existingScript.addEventListener('error', () => reject(new Error('PDF generator failed to load.')), { once: true })
        return
      }

      const script = document.createElement('script')
      script.src = HTML2PDF_CDN_URL
      script.async = true
      script.onload = () => {
        if (window.html2pdf) resolve(window.html2pdf)
        else reject(new Error('PDF generator is unavailable.'))
      }
      script.onerror = () => reject(new Error('PDF generator failed to load. Check your internet connection.'))
      document.head.appendChild(script)
    })
  }

  return html2PdfPromise
}

export const printWithTemporaryBlankTitle = () => {
  const originalTitle = document.title
  document.title = ' '

  const restoreTitle = () => {
    document.title = originalTitle
    window.removeEventListener('afterprint', restoreTitle)
  }

  window.addEventListener('afterprint', restoreTitle)
  window.print()

  // Some browsers do not fire afterprint when the dialog is cancelled.
  window.setTimeout(restoreTitle, 1500)
}

const createPdfStage = (element, options = {}) => {
  const { widthPx, minHeightPx } = getPageSettings(options)
  const overlay = document.createElement('div')
  const clone = element.cloneNode(true)

  // html2canvas can produce a blank PDF when the source is off-screen or behind the page.
  // Keep a temporary visible stage in the viewport while the PDF is rendered, then remove it.
  overlay.setAttribute('data-pdf-export-stage', 'true')
  overlay.style.position = 'fixed'
  overlay.style.inset = '0'
  overlay.style.zIndex = '2147483647'
  overlay.style.width = '100vw'
  overlay.style.height = '100vh'
  overlay.style.overflow = 'auto'
  overlay.style.background = '#ffffff'
  overlay.style.pointerEvents = 'none'
  overlay.style.display = 'flex'
  overlay.style.justifyContent = 'center'
  overlay.style.alignItems = 'flex-start'
  overlay.style.padding = '0'
  overlay.style.margin = '0'

  clone.classList.add('pdf-export-root')
  clone.style.width = `${widthPx}px`
  clone.style.minHeight = `${minHeightPx}px`
  clone.style.background = '#ffffff'
  clone.style.margin = '0 auto'
  clone.style.padding = '0'
  clone.style.boxSizing = 'border-box'

  const style = document.createElement('style')
  style.textContent = `
    [data-pdf-export-stage] .print-hidden {
      display: none !important;
    }

    [data-pdf-export-stage],
    [data-pdf-export-stage] * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    [data-pdf-export-stage] .print-page,
    [data-pdf-export-stage] .print-export-page {
      margin: 0 auto !important;
      box-shadow: none !important;
      break-after: page;
      page-break-after: always;
    }

    [data-pdf-export-stage] .print-page:last-child,
    [data-pdf-export-stage] .print-export-page:last-child {
      break-after: auto;
      page-break-after: auto;
    }
  `

  overlay.appendChild(style)
  overlay.appendChild(clone)

  return { overlay, clone }
}

export const downloadElementAsPdf = async (element, options = {}) => {
  if (!element) throw new Error('Printable content is not ready yet.')

  const html2pdf = await loadHtml2Pdf()
  const { overlay, clone } = createPdfStage(element, options)
  const pageSettings = getPageSettings(options)

  document.body.appendChild(overlay)

  try {
    await document.fonts?.ready
    await waitForImages(clone)
    await waitForNextFrame()

    const exportTarget = clone.querySelector('.print-page, .print-export-page') ? clone : overlay

    await html2pdf()
      .set({
        filename: `${sanitizePdfFileName(options.filename || 'printout')}.pdf`,
        margin: [0, 0, 0, 0],
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          width: pageSettings.widthPx,
          windowWidth: pageSettings.widthPx,
          windowHeight: Math.max(clone.scrollHeight, pageSettings.minHeightPx),
        },
        jsPDF: {
          unit: 'mm',
          format: pageSettings.format,
          orientation: pageSettings.orientation,
        },
        pagebreak: {
          mode: ['css', 'legacy'],
          avoid: ['.avoid-break'],
        },
      })
      .from(exportTarget)
      .save()
  } finally {
    overlay.remove()
  }
}
