import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FiAlertCircle,
  FiEdit3,
  FiFileText,
  FiImage,
  FiLoader,
  FiLock,
  FiUploadCloud,
} from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import UploadDocumentModal from './UploadDocumentModal'
import DocumentImagesModal from './DocumentImagesModal'
import EditListingDocumentsModal from '../../ListingComponents/EditListingDocumentsModal/EditListingDocumentsModal'
import { getDocumentFiles, getDocumentImageUrl, isPdfLike, isProtectedDocumentFile } from './documentFileUtils'
import { getDocumentResponsiblePartyLabel, normalizeDocumentResponsibleParty } from '../../../../utils/documentRequirement'

const statusStyles = {
  Approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Missing: 'border-red-200 bg-red-50 text-red-700',
  Rejected: 'border-red-200 bg-red-50 text-red-700',
}

const StatusPill = ({ value = 'Missing' }) => {
  const label = value === 'Rejected' ? 'Needs Resubmission' : value
  const colored = ['Approved', 'Missing', 'Rejected'].includes(value)
  return <span className={colored ? `inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusStyles[value]}` : 'text-sm font-semibold text-slate-600'}>{label}</span>
}
const LibraryStatusPill = ({ value }) => <span className="text-sm text-slate-600">{String(value || 'active').toLowerCase() === 'active' ? 'Active' : 'Deactivated'}</span>
const RequirementPill = ({ value }) => <span className="text-sm text-slate-600">{value || 'Optional'}</span>
const ResponsibilityPill = ({ value }) => <span className="text-sm text-slate-600">{getDocumentResponsiblePartyLabel(normalizeDocumentResponsibleParty(value))}</span>

const DocumentActionsMenu = ({ children, name }) => {
  const ref = useRef(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  useEffect(() => {
    if (!open) return
    const close = event => { if (!ref.current?.contains(event.target)) ref.current.open = false }
    const closeOnMove = () => { if (ref.current) ref.current.open = false }
    document.addEventListener('pointerdown', close)
    window.addEventListener('scroll', closeOnMove, true)
    window.addEventListener('resize', closeOnMove)
    return () => { document.removeEventListener('pointerdown', close); window.removeEventListener('scroll', closeOnMove, true); window.removeEventListener('resize', closeOnMove) }
  }, [open])
  return <details ref={ref} onToggle={event => {
    const expanded = event.currentTarget.open
    if (expanded) {
      const bounds = event.currentTarget.querySelector('summary').getBoundingClientRect()
      const height = event.currentTarget.querySelector('[data-document-menu]').getBoundingClientRect().height
      setPosition({ left: Math.max(8, Math.min(window.innerWidth - 208, bounds.right - 192)), top: bounds.bottom + height + 8 < window.innerHeight ? bounds.bottom + 4 : Math.max(8, bounds.top - height - 4) })
    }
    setOpen(expanded)
  }} className="relative" onKeyDown={event => {
    if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() }
  }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false }}>
    <summary aria-label={`More actions for ${name}`} className="flex h-9 cursor-pointer list-none items-center rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">More</summary>
    <div data-document-menu style={position} className="fixed z-[90] grid w-48 gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg" onClick={() => { if (ref.current) ref.current.open = false }}>{children}</div>
  </details>
}
const secondaryAction = 'rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50'

const Documents = ({
  documents = [],
  canManage = false,
  canEditRequirements = false,
  projectSlug = '',
  project = {},
  listing = {},
  client = {},
  listingId = '',
  libraryDocuments = [],
  projectDefaultDocuments = [],
  documentTemplates = [],
  templateDocuments = [],
  onUploadDocument,
  onApproveDocument,
  onRequestResubmission,
  onClearDocument,
  onSaveRequirements,
  isSaving = false,
  isSavingRequirements = false,
  readOnly = false,
}) => {
  const rows = documents
  const [uploadDoc, setUploadDoc] = useState(null)
  const [showImages, setShowImages] = useState(false)
  const [showEditRequirements, setShowEditRequirements] = useState(false)
  const [alert, setAlert] = useState(null)
  const [activeDocumentId, setActiveDocumentId] = useState(null)

  const approvedCount = useMemo(
    () => rows.filter((row) => row.status === 'Approved').length,
    [rows]
  )

  const submittedCount = useMemo(
    () => rows.filter((row) => row.status === 'Submitted').length,
    [rows]
  )

  const missingCount = useMemo(
    () => rows.filter((row) => row.status === 'Missing').length,
    [rows]
  )

  const requiredCount = useMemo(
    () => rows.filter((row) => row.requirement === 'Required').length,
    [rows]
  )

  const actionCounts = useMemo(() => rows.reduce((counts, row) => {
    if (row.requirement !== 'Required' || !['Missing', 'Rejected'].includes(row.status)) return counts
    const responsibleParty = normalizeDocumentResponsibleParty(row.responsibleParty || row.responsible_party)
    counts[responsibleParty] += 1
    return counts
  }, { client: 0, internal: 0, seller: 0 }), [rows])

  const handleUploadClick = (document) => {
    if (!canManage) {
      setAlert({ type: 'error', message: 'Reserve this unit first before uploading documents.' })
      return
    }

    setUploadDoc(document)
    setAlert(null)
  }

  const handleUploadSave = async (payload) => {
    if (!uploadDoc) return

    setActiveDocumentId(uploadDoc.id)
    setAlert({ type: 'loading', message: `Saving ${uploadDoc.name}...` })

    try {
      const result = await onUploadDocument?.(uploadDoc, payload)
      setUploadDoc(null)
      setAlert({ type: 'success', message: `${uploadDoc.name} submitted successfully.` })
      return result
    } catch (error) {
      setAlert({ type: 'error', message: error?.message || 'Failed to upload document.' })
      throw error
    } finally {
      setActiveDocumentId(null)
    }
  }

  const handleClearDocument = async (document) => {
    if (!canManage) {
      setAlert({ type: 'error', message: 'Reserve this unit first before clearing documents.' })
      return
    }

    if (!window.confirm(`Clear ${document.name}? This permanently deletes its uploaded files from Cloudinary and marks the document as missing.`)) return

    setActiveDocumentId(document.id)
    setAlert({ type: 'loading', message: `Clearing ${document.name}...` })

    try {
      const result = await onClearDocument?.(document)
      setAlert({ type: 'warning', message: result?.message || `${document.name} was cleared, deleted from Cloudinary, and marked as missing.` })
    } catch (error) {
      setAlert({ type: 'error', message: error?.message || 'Failed to clear document.' })
    } finally {
      setActiveDocumentId(null)
    }
  }

  const handleApproveDocument = async (document) => {
    if (!canManage) {
      setAlert({ type: 'error', message: 'Reserve this unit first before approving documents.' })
      return
    }

    if (['Missing','Rejected'].includes(document.status) || !getDocumentFiles(document).length) {
      setAlert({ type: 'error', message: `Upload ${document.name} before approving it.` })
      return
    }

    if (!window.confirm(`Approve ${document.name}?`)) return

    setActiveDocumentId(document.id)
    setAlert({ type: 'loading', message: `Approving ${document.name}...` })

    try {
      await onApproveDocument?.(document)
      setAlert({ type: 'success', message: `${document.name} approved successfully.` })
    } catch (error) {
      setAlert({ type: 'error', message: error?.message || 'Failed to approve document.' })
    } finally {
      setActiveDocumentId(null)
    }
  }

  const handleRequestResubmission = async (document) => {
    if (normalizeDocumentResponsibleParty(document.responsibleParty || document.responsible_party) !== 'client') {
      setAlert({ type: 'error', message: 'Only client-responsibility documents can be requested for client resubmission.' })
      return
    }
    if (!canManage) {
      setAlert({ type: 'error', message: 'Reserve this unit first before requesting document resubmission.' })
      return
    }
    if (!['Submitted', 'Approved'].includes(document.status)) {
      setAlert({ type: 'error', message: `${document.name} must be submitted or approved before resubmission can be requested.` })
      return
    }

    const confirmed = window.confirm(`Request a corrected ${document.name} from the client? The current copy will stay retained as document history until a corrected copy is uploaded.`)
    if (!confirmed) return

    const reason = window.prompt('Optional resubmission reason. This will be recorded in Audit Logs:', '')
    if (reason === null) return

    setActiveDocumentId(document.id)
    setAlert({ type: 'loading', message: `Marking ${document.name} for resubmission...` })
    try {
      const result = await onRequestResubmission?.(document, { reason: reason.trim() })
      setAlert({ type: 'warning', message: result?.message || `${document.name} now needs a corrected resubmission.` })
    } catch (error) {
      setAlert({ type: 'error', message: error?.message || 'Failed to request document resubmission.' })
    } finally {
      setActiveDocumentId(null)
    }
  }

  const handleSaveRequirements = async (nextDocuments) => {
    setAlert({ type: 'loading', message: 'Saving document requirements...' })

    try {
      await onSaveRequirements?.(nextDocuments)
      setShowEditRequirements(false)
      setAlert({ type: 'success', message: 'Document requirements updated.' })
    } catch (error) {
      setAlert({ type: 'error', message: error?.message || 'Failed to save document requirements.' })
      throw error
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      {alert ? (
        <div className="mb-4">
          <StatusAlert
            type={alert.type}
            message={alert.message}
            onClose={alert.type === 'loading' ? undefined : () => setAlert(null)}
          />
        </div>
      ) : null}

      {!canManage ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{readOnly ? 'Historical account documents are read-only. You can still open and print retained files.' : 'Reserve this unit first before uploading, approving, or clearing buyer documents.'}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-950">Documents</h2>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            {readOnly ? 'View the document checklist and retained files for this buyer account.' : 'Manage required documents, uploads, approvals, and document image previews.'}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-semibold text-slate-600">
              {rows.length} docs
            </span>

            <span className="text-xs font-semibold text-slate-600">
              {approvedCount} approved
            </span>

            <span className="text-xs font-semibold text-slate-600">
              {submittedCount} submitted
            </span>

            <span className="text-xs font-semibold text-slate-600">
              {missingCount} missing
            </span>

            <span className="text-xs font-semibold text-slate-600">
              {requiredCount} required
            </span>

            <span className="text-xs font-semibold text-slate-600">
              {actionCounts.client} client action
            </span>

            <span className="text-xs font-semibold text-slate-600">
              {actionCounts.internal} internal action
            </span>

            <span className="text-xs font-semibold text-slate-600">
              {actionCounts.seller} seller action
            </span>
          </div>

          {!readOnly ? (
            <button
              type="button"
              onClick={() => setShowEditRequirements(true)}
              disabled={!canEditRequirements || isSavingRequirements}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
            >
              <FiEdit3 className="h-4 w-4" />
              Edit Requirements
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setShowImages(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
          >
            <FiImage className="h-4 w-4" />
            Document Images
          </button>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-[1100px] w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['Document', 'Requirement', 'Responsible Party', 'Library Status', 'Submission Status', 'File', 'Actions'].map(
                (head) => (
                  <th
                    key={head}
                    className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500"
                  >
                    {head}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const isActive = activeDocumentId === row.id || isSaving
              const files = getDocumentFiles(row)
              const firstImage = files[0] || null
              const isProtected = isProtectedDocumentFile(firstImage)
              const isPdf = isPdfLike(firstImage || {})
              const imageSrc = isProtected ? '' : (getDocumentImageUrl(firstImage) || row.fileUrl || '')
              const fileCount = Number(row.imageCount ?? files.length ?? 0)

              return (
                <tr key={row.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <p className="font-black text-slate-950">{row.name}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {row.description || 'Document label for buyer requirements.'}
                    </p>
                  </td>

                  <td className="px-4 py-4">
                    <RequirementPill value={row.requirement} />
                  </td>

                  <td className="px-4 py-4">
                    <ResponsibilityPill value={row.responsibleParty || row.responsible_party} />
                  </td>

                  <td className="px-4 py-4">
                    <LibraryStatusPill value={row.libraryStatus} />
                  </td>

                  <td className="px-4 py-4">
                    <StatusPill value={row.status} requirement={row.requirement} />
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        {row.fileName && row.fileName !== '-' && imageSrc && !isProtected && !isPdf ? (
                          <img
                            src={imageSrc}
                            alt={row.name}
                            className="h-full w-full object-cover"
                          />
                        ) : isProtected ? (
                          <FiLock className="h-4 w-4 text-blue-500" />
                        ) : isPdf ? (
                          <FiFileText className="h-4 w-4 text-slate-500" />
                        ) : (
                          <FiImage className="h-4 w-4 text-slate-300" />
                        )}
                      </div>

                      <div>
                        <p className="font-semibold text-slate-700">
                          {row.fileName || '-'}
                        </p>

                        <p className="text-xs font-semibold text-slate-400">
                          {row.fileName && row.fileName !== '-'
                            ? `${fileCount || 1} protected file(s) saved`
                            : 'No file uploaded'}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => files.length && !['Missing','Rejected'].includes(row.status) ? setShowImages([row]) : handleUploadClick(row)}
                        disabled={isActive || (!files.length || ['Missing','Rejected'].includes(row.status)) && (!canManage || readOnly)}
                        className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-xl border border-blue-200 bg-white px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
                        {isActive ? <FiLoader className="animate-spin" /> : files.length && !['Missing','Rejected'].includes(row.status) ? <FiFileText /> : <FiUploadCloud />}
                        {isActive ? 'Saving...' : row.status === 'Rejected' ? 'Upload Corrected Copy' : !files.length || row.status === 'Missing' ? 'Upload File' : row.status === 'Submitted' ? 'Review File' : 'View File'}
                      </button>
                      {!readOnly && canManage && files.length ? <DocumentActionsMenu name={row.name}>
                        {row.status === 'Submitted' ? <button type="button" onClick={() => handleApproveDocument(row)} disabled={isActive} className={secondaryAction}>Approve</button> : null}
                        <button type="button" onClick={() => handleUploadClick(row)} disabled={isActive} className={secondaryAction}>Add Files</button>
                        {normalizeDocumentResponsibleParty(row.responsibleParty || row.responsible_party) === 'client' && ['Submitted','Approved'].includes(row.status) ? <button type="button" onClick={() => handleRequestResubmission(row)} disabled={isActive} className={secondaryAction}>Request Resubmission</button> : null}
                        <button type="button" onClick={() => handleClearDocument(row)} disabled={isActive} className={`${secondaryAction} text-red-700`}>Clear Files</button>
                      </DocumentActionsMenu> : null}
                    </div>
                  </td>
                </tr>
              )
            })}

            {!rows.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <FiImage className="mx-auto h-8 w-8 text-slate-300" />

                  <p className="mt-3 text-sm font-black text-slate-700">
                    No document requirements found
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Reserve this listing or add document requirements first.
                  </p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {!readOnly && uploadDoc ? (
        <UploadDocumentModal
          document={uploadDoc}
          signaturePath={`/projects/lot-projects/${projectSlug}/listings/${listingId || listing?.routeId || listing?.id || listing?.lot_project_listing_id}/documents/${uploadDoc.id}/upload-signature`}
          isSaving={activeDocumentId === uploadDoc.id || isSaving}
          onClose={() => {
            setUploadDoc(null)
            setAlert(null)
          }}
          onSave={handleUploadSave}
        />
      ) : null}

      {showImages ? (
        <DocumentImagesModal
          documents={Array.isArray(showImages) ? showImages : rows}
          onClose={() => setShowImages(false)}
        />
      ) : null}

      {!readOnly && showEditRequirements ? (
        <EditListingDocumentsModal
          selectedDocuments={rows}
          libraryDocuments={libraryDocuments}
          projectDefaultDocuments={projectDefaultDocuments}
          documentTemplates={documentTemplates}
          templateDocuments={templateDocuments}
          title="Edit Document Requirements"
          subtitle="Changes apply to this existing listing. Removed requirements are hidden from the checklist, but existing uploaded files are not deleted."
          saveLabel="Save Requirements"
          isSaving={isSavingRequirements}
          onSave={handleSaveRequirements}
          onClose={() => setShowEditRequirements(false)}
        />
      ) : null}
    </section>
  )
}

export default Documents



