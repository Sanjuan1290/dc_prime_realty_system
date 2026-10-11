import { useEffect, useRef, useState } from 'react'
import { FiCamera, FiCameraOff, FiX } from 'react-icons/fi'
import { decodeCode128FromImageData } from '../../../utils/code128'

const BarcodeScanner = ({ onDetected, onClose, title = 'Scan Barcode' }) => {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const busyRef = useRef(false)
  const onDetectedRef = useRef(onDetected)
  const [notice, setNotice] = useState('Starting camera...')
  const [cameraAvailable, setCameraAvailable] = useState(true)
  const [scannerMode, setScannerMode] = useState('camera')

  useEffect(() => { onDetectedRef.current = onDetected }, [onDetected])

  useEffect(() => {
    let cancelled = false

    const stop = () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
      streamRef.current?.getTracks?.().forEach((track) => track.stop())
      streamRef.current = null
    }

    const detectWithLocalCode128 = (video) => {
      const canvas = canvasRef.current
      if (!canvas || !video?.videoWidth || !video?.videoHeight) return null
      const maxWidth = 960
      const scale = Math.min(1, maxWidth / video.videoWidth)
      const width = Math.max(320, Math.floor(video.videoWidth * scale))
      const height = Math.max(180, Math.floor(video.videoHeight * scale))
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) return null
      context.drawImage(video, 0, 0, width, height)
      const imageData = context.getImageData(0, 0, width, height)
      return decodeCode128FromImageData(imageData, width, height)
    }

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraAvailable(false)
        setScannerMode('manual-only')
        setNotice('Camera access is not available on this device or browser. Use a physical barcode scanner or enter the code manually on the Attendance page.')
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        let detector = null
        if ('BarcodeDetector' in window) {
          try {
            const formats = typeof window.BarcodeDetector.getSupportedFormats === 'function'
              ? await window.BarcodeDetector.getSupportedFormats()
              : ['code_128']
            if (formats.includes('code_128')) detector = new window.BarcodeDetector({ formats: ['code_128'] })
          } catch {
            detector = null
          }
        }

        setScannerMode(detector ? 'native+fallback' : 'code128-fallback')
        setNotice(detector
          ? 'Camera ready. Point it at the employee barcode.'
          : 'Camera ready. Using the built-in Code 128 scanner. Point it at the employee barcode.')

        timerRef.current = setInterval(async () => {
          const video = videoRef.current
          if (busyRef.current || !video || video.readyState < 2) return
          busyRef.current = true
          try {
            let rawValue = ''
            if (detector) {
              try {
                const detected = await detector.detect(video)
                rawValue = detected?.[0]?.rawValue?.trim() || ''
              } catch {
                // Continue to the local Code 128 fallback below.
              }
            }

            if (!rawValue) rawValue = detectWithLocalCode128(video)?.trim() || ''

            if (rawValue) {
              stop()
              onDetectedRef.current?.(rawValue)
            }
          } finally {
            busyRef.current = false
          }
        }, 260)
      } catch (error) {
        setCameraAvailable(false)
        setScannerMode('manual-only')
        setNotice(error?.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access, or use a physical barcode scanner/manual code entry on the Attendance page.'
          : 'The camera could not be opened. Use a physical barcode scanner or enter the code manually on the Attendance page.')
      }
    }

    void start()
    return () => {
      cancelled = true
      stop()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><FiCamera /></span>
            <div><h3 className="font-black text-slate-950">{title}</h3><p className="text-xs font-semibold text-slate-500">Use the laptop, desktop webcam, tablet, or phone camera as the barcode scanner.</p></div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><FiX /></button>
        </div>

        <div className="p-5">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-950">
            {cameraAvailable ? <video ref={videoRef} muted playsInline className="h-full w-full object-cover" /> : (
              <div className="flex h-full items-center justify-center text-slate-400"><FiCameraOff className="h-12 w-12" /></div>
            )}
            {cameraAvailable ? (
              <>
                <div className="pointer-events-none absolute inset-x-[10%] top-1/2 h-[42%] -translate-y-1/2 rounded-2xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(2,6,23,0.22)]" />
                <div className="pointer-events-none absolute left-[12%] right-[12%] top-1/2 h-0.5 -translate-y-1/2 bg-red-400/80" />
              </>
            ) : null}
          </div>
          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
          <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${cameraAvailable ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800'}`}>{notice}</p>
          {scannerMode === 'code128-fallback' ? <p className="mt-2 text-xs font-semibold text-slate-500">This browser does not need native BarcodeDetector support. The system scans the generated D&amp;C Code 128 employee barcodes directly from camera frames.</p> : null}
        </div>
      </div>
    </div>
  )
}

export default BarcodeScanner

