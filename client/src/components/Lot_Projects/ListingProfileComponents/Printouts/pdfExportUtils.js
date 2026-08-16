export const sanitizePdfFileName = (value = 'printout') => {
  const cleaned = String(value || 'printout')
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return cleaned || 'printout'
}

const wait = (milliseconds = 0) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

const waitForNextFrame = (targetWindow = window) => new Promise((resolve) => {
  targetWindow.requestAnimationFrame(() => targetWindow.requestAnimationFrame(resolve))
})

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

const waitForWindowReady = async (targetWindow) => {
  if (!targetWindow) throw new Error('PDF print window could not be opened. Allow pop-ups and try again.')

  if (targetWindow.document.readyState !== 'complete') {
    await new Promise((resolve) => {
      targetWindow.addEventListener('load', resolve, { once: true })
      window.setTimeout(resolve, 1200)
    })
  }

  await targetWindow.document.fonts?.ready?.catch?.(() => null)
  await waitForImages(targetWindow.document)
  await waitForNextFrame(targetWindow)
  await wait(250)
}

const collectCurrentPageStyles = () => {
  const styleNodes = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))

  return styleNodes
    .map((node) => node.outerHTML)
    .join('\n')
}

const createPdfPrintStyles = () => `
  <style>
    @page {
      size: A4 portrait;
      margin: 0 !important;
    }

    html,
    body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      overflow: visible !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .print-hidden,
    .pdf-window-hidden {
      display: none !important;
    }

    .pdf-print-root {
      width: 100%;
      min-height: 100vh;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
    }

    .print-content,
    .print-preview-pages {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
    }

    .print-page,
    .print-export-page {
      margin: 0 auto !important;
      box-shadow: none !important;
      break-after: page;
      page-break-after: always;
      background: #ffffff !important;
    }

    .print-page:last-child,
    .print-export-page:last-child {
      break-after: auto;
      page-break-after: auto;
    }

    @media print {
      html,
      body,
      .pdf-print-root {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        overflow: visible !important;
      }
    }
  </style>
`

const buildPrintableHtml = (element, options = {}) => {
  const clonedElement = element.cloneNode(true)
  clonedElement.classList.add('pdf-print-root')

  // Do not copy action bars, modal chrome, or status banners into the PDF print window.
  clonedElement.querySelectorAll('.print-hidden, .pdf-window-hidden').forEach((node) => node.remove())

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base href="${window.location.origin}/" />
    <title>${options.blankTitle === false ? sanitizePdfFileName(options.filename || 'printout') : ' '}</title>
    ${collectCurrentPageStyles()}
    ${createPdfPrintStyles()}
  </head>
  <body>
    ${clonedElement.outerHTML}
  </body>
</html>`
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

export const openElementInPdfPrintWindow = async (element, options = {}) => {
  if (!element) throw new Error('Printable content is not ready yet.')

  // Open synchronously from the button click so the browser does not block the print window.
  const pdfWindow = window.open('', '_blank')

  if (!pdfWindow) {
    throw new Error('PDF window was blocked. Allow pop-ups for this site and try again.')
  }

  pdfWindow.document.open()
  pdfWindow.document.write(`<!doctype html><html><head><title>Preparing PDF</title></head><body style="font-family: Arial, sans-serif; padding: 24px;">Preparing PDF preview...</body></html>`)
  pdfWindow.document.close()

  await wait(50)

  pdfWindow.document.open()
  pdfWindow.document.write(buildPrintableHtml(element, options))
  pdfWindow.document.close()

  await waitForWindowReady(pdfWindow)

  pdfWindow.focus()
  pdfWindow.print()

  return true
}

// Kept as the public function used by the print buttons. It opens Chrome's clean Save-as-PDF print flow
// instead of converting the page through canvas, which was producing blank PDFs for some uploaded images.
export const downloadElementAsPdf = openElementInPdfPrintWindow
