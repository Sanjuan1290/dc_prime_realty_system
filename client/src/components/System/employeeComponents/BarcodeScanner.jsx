import { useEffect, useRef, useState } from 'react'
import { FiCamera, FiCameraOff, FiX } from 'react-icons/fi'

const BarcodeScanner = ({ onDetected, onClose, title = 'Scan Barcode' }) => {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const busyRef = useRef(false)
  const onDetectedRef = useRef(onDetected)
  const [notice, setNotice] = useState('Starting camera...')
  const [supported, setSupported] = useState(true)

  useEffect(() => { onDetectedRef.current = onDetected }, [onDetected])

  useEffect(() => {
    let cancelled = false

    const stop = () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
      streamRef.current?.getTracks?.().forEach((track) => track.stop())
      streamRef.current = null
    }

    const start = async () => {
      if (!('BarcodeDetector' in window)) {
        setSupported(false)
        setNotice('Camera barcode detection is not supported on this browser. Enter the barcode code manually or use a physical barcode scanner.')
        return
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setSupported(false)
        setNotice('Camera access is not available. Enter the barcode code manually or use a physical barcode scanner.')
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        const detector = new window.BarcodeDetector({ formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'] })
        setNotice('Point the camera at the employee barcode.')
        timerRef.current = setInterval(async () => {
          if (busyRef.current || !videoRef.current || videoRef.current.readyState < 2) return
          busyRef.current = true
          try {
            const detected = await detector.detect(videoRef.current)
            const rawValue = detected?.[0]?.rawValue?.trim()
            if (rawValue) {
              stop()
              onDetectedRef.current?.(rawValue)
            }
          } catch {
            // Detection failures are expected while frames are changing; keep scanning.
          } finally {
            busyRef.current = false
          }
        }, 350)
      } catch (error) {
        setSupported(false)
        setNotice(error?.name === 'NotAllowedError'
          ? 'Camera permission was denied. Enter the barcode code manually or use a physical barcode scanner.'
          : 'Camera could not be opened. Enter the barcode code manually or use a physical barcode scanner.')
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
            <div><h3 className="font-black text-slate-950">{title}</h3><p className="text-xs font-semibold text-slate-500">Use the device camera to read the barcode.</p></div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><FiX /></button>
        </div>

        <div className="p-5">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-950">
            {supported ? <video ref={videoRef} muted playsInline className="h-full w-full object-cover" /> : (
              <div className="flex h-full items-center justify-center text-slate-400"><FiCameraOff className="h-12 w-12" /></div>
            )}
            <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/80" />
          </div>
          <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${supported ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800'}`}>{notice}</p>
        </div>
      </div>
    </div>
  )
}

export default BarcodeScanner
