import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiLoader,
  FiShield,
  FiX,
  FiXCircle,
} from 'react-icons/fi'
import { requestApi } from '../../../utils/apiClient'

const UploadSecurityContext = createContext(null)

const STORAGE_KEY = 'dc_prime_upload_security_tasks_v1'
const MAX_SAVED_TASKS = 30
const POLL_INTERVAL_MS = 3_000
const AUTO_DISMISS_DELAY_MS = 1_500
const FADE_DURATION_MS = 300

const terminalStatuses = new Set([
  'passed',
  'unscanned',
  'failed',
  'rejected',
  'scan_error',
  'cancelled',
])

const attentionStatuses = new Set([
  'unscanned',
  'failed',
  'rejected',
  'scan_error',
  'cancelled',
])

const clean = (value) => String(value ?? '').trim()

const createTaskId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const loadStoredTasks = () => {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.slice(-MAX_SAVED_TASKS).map((task) => {
      const status = clean(task?.status) || 'failed'
      if (status === 'scanning' && task?.accessPath) return task
      if (terminalStatuses.has(status)) return task
      return {
        ...task,
        status: 'failed',
        message: 'Upload was interrupted before it finished. Please upload the file again.',
        updatedAt: Date.now(),
      }
    })
  } catch {
    return []
  }
}

const statusMeta = (task = {}) => {
  switch (task.status) {
    case 'queued':
      return {
        icon: FiLoader,
        iconClass: 'animate-spin text-slate-500',
        title: 'Preparing upload...',
        textClass: 'text-slate-600',
      }
    case 'uploading':
      return {
        icon: FiLoader,
        iconClass: 'animate-spin text-blue-600',
        title: 'Uploading...',
        textClass: 'text-blue-700',
      }
    case 'saving':
      return {
        icon: FiLoader,
        iconClass: 'animate-spin text-blue-600',
        title: 'Upload successful · Saving secure record...',
        textClass: 'text-blue-700',
      }
    case 'waiting_confirmation':
      return {
        icon: FiAlertTriangle,
        iconClass: 'text-amber-600',
        title: 'Security scan unavailable',
        textClass: 'text-amber-700',
      }
    case 'scanning':
      return {
        icon: FiLoader,
        iconClass: 'animate-spin text-amber-600',
        title: 'Upload successful · Security scan in progress...',
        textClass: 'text-amber-700',
      }
    case 'passed':
      return {
        icon: FiCheckCircle,
        iconClass: 'text-emerald-600',
        title: 'Security scan passed',
        textClass: 'text-emerald-700',
      }
    case 'unscanned':
      return {
        icon: FiAlertTriangle,
        iconClass: 'text-amber-600',
        title: 'Upload successful · Not security scanned',
        textClass: 'text-amber-700',
      }
    case 'rejected':
      return {
        icon: FiXCircle,
        iconClass: 'text-red-600',
        title: 'Security scan failed · Malware detected',
        textClass: 'text-red-700',
      }
    case 'scan_error':
      return {
        icon: FiXCircle,
        iconClass: 'text-red-600',
        title: 'Security scan error',
        textClass: 'text-red-700',
      }
    case 'cancelled':
      return {
        icon: FiXCircle,
        iconClass: 'text-slate-400',
        title: 'Upload cancelled',
        textClass: 'text-slate-500',
      }
    default:
      return {
        icon: FiXCircle,
        iconClass: 'text-red-600',
        title: 'Upload failed',
        textClass: 'text-red-700',
      }
  }
}

const resolveFinalScanStatus = (value) => {
  const status = clean(value).toLowerCase()
  if (status === 'approved') return 'passed'
  if (status === 'not_scanned') return 'unscanned'
  if (status === 'rejected') return 'rejected'
  if (status === 'error') return 'scan_error'
  return 'scanning'
}

const UploadSecurityProvider = ({ children }) => {
  const [tasks, setTasks] = useState(loadStoredTasks)
  const [collapsed, setCollapsed] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const pollingIds = useRef(new Set())

  const updateUpload = useCallback((id, patch = {}) => {
    if (!id) return
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              ...patch,
              updatedAt: Date.now(),
            }
          : task
      )
    )
  }, [])

  const addUpload = useCallback(({ fileName, category = 'Protected file', detail = '' } = {}) => {
    const id = createTaskId()
    const now = Date.now()
    setTasks((current) => [
      ...current.slice(-(MAX_SAVED_TASKS - 1)),
      {
        id,
        fileName: clean(fileName) || 'File',
        category: clean(category) || 'Protected file',
        detail: clean(detail),
        status: 'queued',
        message: 'Waiting to upload.',
        accessPath: '',
        createdAt: now,
        updatedAt: now,
      },
    ])
    setCollapsed(false)
    return id
  }, [])

  const beginSecurityScan = useCallback((id, {
    accessPath = '',
    malwareScanStatus = 'pending',
    message = '',
  } = {}) => {
    let finalStatus = resolveFinalScanStatus(malwareScanStatus)
    if (finalStatus === 'scanning' && !clean(accessPath)) finalStatus = 'scan_error'
    const defaultMessage = finalStatus === 'passed'
      ? 'Upload completed and the file passed malware scanning.'
      : finalStatus === 'unscanned'
        ? 'The file was uploaded without malware scanning because the scanning quota was unavailable.'
        : finalStatus === 'rejected'
          ? 'Malware or malicious content was detected. The file is blocked.'
          : finalStatus === 'scan_error'
            ? (clean(accessPath)
                ? 'The upload completed, but the security scan did not complete successfully.'
                : 'The upload completed, but the saved security-status reference is unavailable.')
            : 'The upload completed. Waiting for the malware scan result.'

    updateUpload(id, {
      status: finalStatus,
      accessPath: clean(accessPath),
      message: message || defaultMessage,
      scanStartedAt: Date.now(),
      pollFailures: 0,
    })
  }, [updateUpload])

  const failUpload = useCallback((id, error, fallbackMessage = 'The file could not be uploaded.') => {
    const code = clean(error?.code)
    if (code === 'MALWARE_DETECTED') {
      updateUpload(id, {
        status: 'rejected',
        message: error?.message || 'Malware or malicious content was detected. The file is blocked.',
      })
      return
    }
    if (code === 'MALWARE_SCAN_ERROR') {
      updateUpload(id, {
        status: 'scan_error',
        message: error?.message || 'The upload completed, but the security scan failed.',
      })
      return
    }
    updateUpload(id, {
      status: 'failed',
      message: error?.message || fallbackMessage,
    })
  }, [updateUpload])

  const dismissAll = useCallback(() => {
    setIsClosing(false)
    setCollapsed(false)
    setTasks([])
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tasks.slice(-MAX_SAVED_TASKS)))
    } catch {
      // The status center still works when browser storage is unavailable.
    }
  }, [tasks])

  const allFinished = tasks.length > 0 && tasks.every((task) => terminalStatuses.has(task.status))
  const allPassed = allFinished && tasks.every((task) => task.status === 'passed')
  const hasAttention = tasks.some((task) => attentionStatuses.has(task.status))
  const canDismissAll = allFinished && hasAttention

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    if (!allPassed) {
      setIsClosing(false)
      return undefined
    }

    setIsClosing(false)

    const completedTaskIds = new Set(tasks.map((task) => task.id))
    let removeTimer

    const fadeTimer = window.setTimeout(() => {
      setIsClosing(true)

      removeTimer = window.setTimeout(() => {
        setTasks((current) => {
          const sameCompletedBatch =
            current.length === completedTaskIds.size &&
            current.every((task) => completedTaskIds.has(task.id) && task.status === 'passed')

          return sameCompletedBatch ? [] : current
        })
        setIsClosing(false)
      }, FADE_DURATION_MS)
    }, AUTO_DISMISS_DELAY_MS)

    return () => {
      window.clearTimeout(fadeTimer)
      if (removeTimer) window.clearTimeout(removeTimer)
    }
  }, [allPassed, tasks])

  useEffect(() => {
    const scanTasks = tasks.filter((task) => task.status === 'scanning' && task.accessPath)
    if (!scanTasks.length) return undefined

    let cancelled = false

    const pollTask = async (task) => {
      if (pollingIds.current.has(task.id)) return
      pollingIds.current.add(task.id)

      try {
        const result = await requestApi(task.accessPath, {
          method: 'GET',
          redirectOnUnavailable: false,
          timeoutMs: 12_000,
          headers: { Accept: 'application/json' },
        })
        if (cancelled) return

        const scanStatus = clean(
          result?.data?.malwareScanStatus ||
          result?.malwareScanStatus ||
          'approved'
        ).toLowerCase()

        beginSecurityScan(task.id, {
          accessPath: task.accessPath,
          malwareScanStatus: scanStatus,
        })
      } catch (error) {
        if (cancelled) return

        if (error?.code === 'MALWARE_SCAN_PENDING' || Number(error?.status || 0) === 423) {
          const elapsed = Date.now() - Number(task.scanStartedAt || task.createdAt || Date.now())
          updateUpload(task.id, {
            status: 'scanning',
            message: elapsed >= 5 * 60_000
              ? 'Security scanning is taking longer than expected. It is still running in the background.'
              : 'The upload completed. Waiting for the malware scan result.',
            pollFailures: 0,
          })
          return
        }

        if (error?.code === 'MALWARE_DETECTED') {
          updateUpload(task.id, {
            status: 'rejected',
            message: error?.message || 'Malware or malicious content was detected. The file is blocked.',
          })
          return
        }

        if (error?.code === 'MALWARE_SCAN_ERROR') {
          updateUpload(task.id, {
            status: 'scan_error',
            message: error?.message || 'The security scan did not complete successfully.',
          })
          return
        }

        const nextFailures = Number(task.pollFailures || 0) + 1
        updateUpload(task.id, {
          status: 'scanning',
          pollFailures: nextFailures,
          message: nextFailures >= 2
            ? 'Security status is temporarily unavailable. Retrying automatically...'
            : task.message,
        })
      } finally {
        pollingIds.current.delete(task.id)
      }
    }

    const poll = () => {
      scanTasks.forEach((task) => {
        void pollTask(task)
      })
    }

    const intervalId = window.setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [tasks, beginSecurityScan, updateUpload])

  const value = useMemo(() => ({
    tasks,
    addUpload,
    updateUpload,
    beginSecurityScan,
    failUpload,
    dismissAll,
  }), [
    tasks,
    addUpload,
    updateUpload,
    beginSecurityScan,
    failUpload,
    dismissAll,
  ])

  const activeCount = tasks.filter((task) => !terminalStatuses.has(task.status)).length

  return (
    <UploadSecurityContext.Provider value={value}>
      {children}

      {tasks.length ? (
        <aside className={`fixed bottom-4 right-4 z-[95] w-[calc(100vw-2rem)] max-w-[410px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 transition-opacity duration-300 ${isClosing ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
          <header className="flex items-center justify-between gap-3 bg-slate-950 px-4 py-3 text-white">
            <button
              type="button"
              onClick={() => setCollapsed((current) => !current)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              aria-expanded={!collapsed}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600">
                <FiShield className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">Uploads &amp; Security</span>
                <span className="block text-[11px] font-semibold text-slate-300">
                  {activeCount ? `${activeCount} in progress` : allPassed ? 'All uploads passed security scan' : hasAttention ? 'Review required' : `${tasks.length} recent upload${tasks.length === 1 ? '' : 's'}`}
                </span>
              </span>
            </button>

            <div className="flex items-center gap-1">
              {canDismissAll ? (
                <button
                  type="button"
                  onClick={dismissAll}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
                  aria-label="Dismiss upload security status"
                  title="Dismiss"
                >
                  <FiX />
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setCollapsed((current) => !current)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
                aria-label={collapsed ? 'Expand upload status' : 'Minimize upload status'}
              >
                {collapsed ? <FiChevronUp /> : <FiChevronDown />}
              </button>
            </div>
          </header>

          {!collapsed ? (
            <>
              <div className="max-h-[360px] overflow-y-auto">
                {[...tasks].reverse().map((task) => {
                  const meta = statusMeta(task)
                  const Icon = meta.icon
                  return (
                    <div key={task.id} className="flex gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50">
                        <Icon className={`h-4 w-4 ${meta.iconClass}`} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black text-slate-950" title={task.fileName}>{task.fileName}</p>
                            <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              {task.category}{task.detail ? ` · ${task.detail}` : ''}
                            </p>
                          </div>

                        </div>

                        <p className={`mt-1 text-xs font-black ${meta.textClass}`}>{meta.title}</p>
                        {task.message ? (
                          <p className="mt-0.5 text-[11px] font-semibold leading-4 text-slate-500">{task.message}</p>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>

            </>
          ) : null}
        </aside>
      ) : null}
    </UploadSecurityContext.Provider>
  )
}

export const useUploadSecurity = () => {
  const context = useContext(UploadSecurityContext)
  if (!context) throw new Error('useUploadSecurity must be used inside UploadSecurityProvider.')
  return context
}

export default UploadSecurityProvider
