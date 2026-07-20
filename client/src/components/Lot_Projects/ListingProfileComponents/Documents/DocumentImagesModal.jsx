import { useMemo, useState } from 'react'
import { FiExternalLink, FiEye, FiFileText, FiImage, FiLoader, FiLock, FiSearch, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import { useFetch } from '../../../../utils/useFetch'

const statusStyles = {
  Approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Submitted: 'border-blue-200 bg-blue-50 text-blue-700',
  Missing: 'border-red-200 bg-red-50 text-red-700',
  Rejected: 'border-red-200 bg-red-50 text-red-700',
  Pending: 'border-amber-200 bg-amber-50 text-amber-700',
}

const StatusPill = ({ value }) => (
  <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${statusStyles[value] || 'border-slate-200 bg-slate-100 text-slate-600'}`}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" />
    {value || 'Missing'}
  </span>
)

const normalizeFileEntry = (file, document, index) => {
  if (!file) return null
  if (typeof file === 'string') {
    return {
      url: file,
      fileName: `${document.name || 'Document'} File ${index + 1}`,
      resourceType: file.toLowerCase().includes('.pdf') ? 'raw' : 'image',
      protected: false,
    }
  }

  const url = file.url || file.secure_url || file.fileUrl || file.file_url || ''
  const accessPath = file.accessPath || file.access_path || (file.fileId ? `/document-files/${file.fileId}/access-url` : '')
  if (!url && !accessPath && !file.fileId) return null

  return {
    ...file,
    url,
    accessPath,
    protected: Boolean(file.protected || accessPath || file.fileId),
    fileName: file.fileName || file.file_name || file.originalFilename || file.original_filename || `${document.name || 'Document'} File ${index + 1}`,
    resourceType: file.cloudinaryResourceType || file.resource_type || file.resourceType || (String(file.fileType || '').includes('pdf') ? 'raw' : 'image'),
  }
}

const getDocumentFiles = (document) => {
  const source = Array.isArray(document.imageEntries) && document.imageEntries.length
    ? document.imageEntries
    : Array.isArray(document.images)
      ? document.images
      : document.fileUrl
        ? [document.fileUrl]
        : []
  return source.map((file, index) => normalizeFileEntry(file, document, index)).filter(Boolean)
}

const isPdfLike = (file) => `${file.url || ''} ${file.fileName || ''} ${file.fileType || ''} ${file.resourceType || ''}`.toLowerCase().includes('pdf')

const DocumentImagesModal = ({ documents = [], onClose }) => {
  const [search, setSearch] = useState('')
  const [previewFile, setPreviewFile] = useState(null)
  const [loadingKey, setLoadingKey] = useState('')
  const [notice, setNotice] = useState(null)
  const [resolvedUrls, setResolvedUrls] = useState({})

  const filteredDocuments = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return documents
    return documents.filter((document) => {
      const files = getDocumentFiles(document)
      return `${document.name} ${document.status} ${document.fileName} ${files.map((file) => file.fileName).join(' ')}`.toLowerCase().includes(keyword)
    })
  }, [documents, search])

  const resolveFileUrl = async (file, key) => {
    if (file.url && !file.protected) return file.url
    if (resolvedUrls[key]) return resolvedUrls[key]
    if (!file.accessPath) throw new Error('This protected file does not have an access route.')

    setLoadingKey(key)
    setNotice({ type: 'loading', message: 'Generating a secure document link...' })
    try {
      const result = await useFetch(file.accessPath)
      const url = result?.data?.url
      if (!url) throw new Error('The server did not return a document link.')
      setResolvedUrls((current) => ({ ...current, [key]: url }))
      setNotice(null)
      return url
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Failed to open the protected document.' })
      throw error
    } finally {
      setLoadingKey('')
    }
  }

  const openFile = async (file, document, index) => {
    const key = `${document.id}-${file.fileId || file.cloudinaryPublicId || index}`
    try {
      const url = await resolveFileUrl(file, key)
      if (isPdfLike(file)) {
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        setPreviewFile({ ...file, url, documentName: document.name, index })
      }
    } catch {
      // Error is shown in the modal.
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-black text-slate-950">Document Files</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Open uploaded files through protected, short-lived links.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100" aria-label="Close document files">
            <FiX className="h-4 w-4" />
          </button>
        </header>

        <div className="shrink-0 border-b border-slate-200 bg-slate-50 p-5">
          {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} className="mb-3" /> : null}
          <label className="relative block">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search document, file name, or status..." className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50" />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredDocuments.map((document) => {
              const files = getDocumentFiles(document)
              return (
                <section key={document.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
                    <div>
                      <h3 className="text-base font-black text-slate-950">{document.name}</h3>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{files.length ? `${files.length} uploaded file(s)` : 'No file uploaded'}</p>
                    </div>
                    <StatusPill value={document.status} />
                  </div>

                  <div className="p-4">
                    {files.length ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {files.map((file, index) => {
                          const key = `${document.id}-${file.fileId || file.cloudinaryPublicId || index}`
                          const isPdf = isPdfLike(file)
                          const isLoading = loadingKey === key
                          return (
                            <button key={key} type="button" onClick={() => openFile(file, document, index)} disabled={Boolean(loadingKey)} className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left transition hover:border-blue-300 hover:ring-4 hover:ring-blue-50 disabled:opacity-60">
                              <div className="flex aspect-[4/3] flex-col items-center justify-center bg-slate-100 text-slate-500">
                                {isLoading ? <FiLoader className="h-9 w-9 animate-spin text-blue-600" /> : isPdf ? <FiFileText className="h-10 w-10" /> : file.protected ? <FiLock className="h-10 w-10" /> : <FiImage className="h-10 w-10" />}
                                <span className="mt-2 text-xs font-black">{isLoading ? 'Opening...' : file.protected ? 'Protected file' : isPdf ? 'Open PDF' : 'Preview image'}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 p-3">
                                <span className="truncate text-xs font-black text-slate-700">{file.fileName || `File ${index + 1}`}</span>
                                <span className="inline-flex items-center gap-1 text-xs font-black text-blue-700">{isPdf ? <FiExternalLink /> : <FiEye />} Open</span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                        <FiImage className="mx-auto h-8 w-8 text-slate-300" />
                        <p className="mt-2 text-sm font-black text-slate-700">No stored file</p>
                      </div>
                    )}
                  </div>
                </section>
              )
            })}
          </div>

          {!filteredDocuments.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <FiImage className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-black text-slate-700">No document files found</p>
            </div>
          ) : null}
        </div>

        <footer className="flex shrink-0 justify-end border-t border-slate-200 bg-white px-5 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50">Close</button>
        </footer>
      </div>

      {previewFile ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-4" onClick={() => setPreviewFile(null)}>
          <div className="max-h-[92vh] max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950">{previewFile.documentName}</p>
                <p className="truncate text-xs font-semibold text-slate-500">{previewFile.fileName}</p>
              </div>
              <button type="button" onClick={() => setPreviewFile(null)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><FiX /></button>
            </div>
            <div className="max-h-[80vh] overflow-auto bg-slate-950 p-3">
              <img src={previewFile.url} alt={previewFile.fileName || 'Document preview'} className="mx-auto max-h-[76vh] max-w-full object-contain" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default DocumentImagesModal
