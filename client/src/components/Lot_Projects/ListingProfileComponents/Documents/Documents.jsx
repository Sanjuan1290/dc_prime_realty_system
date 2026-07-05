import { useMemo, useState } from 'react'
import {
  FiCheckCircle,
  FiImage,
  FiLoader,
  FiTrash2,
  FiUploadCloud,
} from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import UploadDocumentModal from './UploadDocumentModal'
import DocumentImagesModal from './DocumentImagesModal'

const imagePlaceholder = '/docImage1.png'

const statusStyles = {
  Approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Submitted: 'border-blue-200 bg-blue-50 text-blue-700',
  Missing: 'border-red-200 bg-red-50 text-red-700',
  Pending: 'border-amber-200 bg-amber-50 text-amber-700',
}

const requirementStyles = {
  Required: 'border-blue-200 bg-blue-50 text-blue-700',
  Optional: 'border-slate-200 bg-slate-100 text-slate-600',
}

const StatusPill = ({ value }) => (
  <span
    className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${
      statusStyles[value] || 'border-slate-200 bg-slate-100 text-slate-600'
    }`}
  >
    <span className="h-1.5 w-1.5 rounded-full bg-current" />
    {value || 'Missing'}
  </span>
)

const RequirementPill = ({ value }) => (
  <span
    className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-black ${
      requirementStyles[value] || requirementStyles.Optional
    }`}
  >
    {value || 'Optional'}
  </span>
)

const Documents = ({ documents = [] }) => {
  const [rows, setRows] = useState(documents)
  const [uploadDoc, setUploadDoc] = useState(null)
  const [showImages, setShowImages] = useState(false)
  const [alert, setAlert] = useState(null)
  const [clearingId, setClearingId] = useState(null)

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

  const handleUploadClick = (document) => {
    setUploadDoc(document)
    setAlert({
      type: 'info',
      message: `Uploading document for ${document.name}.`,
    })
  }

  const handleUploadSave = (fileName) => {
    if (!uploadDoc) return

    setAlert({
      type: 'loading',
      message: 'Saving uploaded document...',
    })

    window.setTimeout(() => {
      setRows((current) =>
        current.map((document) =>
          document.id === uploadDoc.id
            ? {
                ...document,
                status: 'Submitted',
                fileName,
                images: [imagePlaceholder],
              }
            : document
        )
      )

      setUploadDoc(null)

      setAlert({
        type: 'success',
        message: `${uploadDoc.name} submitted successfully.`,
      })
    }, 500)
  }

  const handleClearDocument = (document) => {
    setClearingId(document.id)
    setAlert({
      type: 'loading',
      message: `Clearing ${document.name}...`,
    })

    window.setTimeout(() => {
      setRows((current) =>
        current.map((item) =>
          item.id === document.id
            ? {
                ...item,
                status: 'Missing',
                fileName: '-',
                images: [],
              }
            : item
        )
      )

      setClearingId(null)

      setAlert({
        type: 'warning',
        message: `${document.name} was cleared and marked as missing.`,
      })
    }, 500)
  }

  const handleApproveDocument = (document) => {
    if (document.status === 'Missing') {
      setAlert({
        type: 'error',
        message: `Upload ${document.name} before approving it.`,
      })
      return
    }

    setAlert({
      type: 'loading',
      message: `Approving ${document.name}...`,
    })

    window.setTimeout(() => {
      setRows((current) =>
        current.map((item) =>
          item.id === document.id
            ? {
                ...item,
                status: 'Approved',
              }
            : item
        )
      )

      setAlert({
        type: 'success',
        message: `${document.name} approved successfully.`,
      })
    }, 500)
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

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-950">Documents</h2>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            Manage required documents, uploads, approvals, and document image previews.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
              {rows.length} docs
            </span>

            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
              {approvedCount} approved
            </span>

            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
              {submittedCount} submitted
            </span>

            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
              {missingCount} missing
            </span>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
              {requiredCount} required
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowImages(true)
              setAlert({
                type: 'info',
                message: 'Document Images opened.',
              })
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
          >
            <FiImage className="h-4 w-4" />
            Document Images
          </button>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-[900px] w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['Document', 'Requirement', 'Status', 'File', 'Actions'].map(
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
              const isClearing = clearingId === row.id

              return (
                <tr key={row.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <p className="font-black text-slate-950">{row.name}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Document label for buyer requirements.
                    </p>
                  </td>

                  <td className="px-4 py-4">
                    <RequirementPill value={row.requirement} />
                  </td>

                  <td className="px-4 py-4">
                    <StatusPill value={row.status} />
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        {row.fileName && row.fileName !== '-' ? (
                          <img
                            src={imagePlaceholder}
                            alt={row.name}
                            className="h-full w-full object-cover"
                          />
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
                            ? 'Image preview available'
                            : 'No file uploaded'}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleUploadClick(row)}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        <FiUploadCloud className="h-4 w-4" />
                        Upload
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApproveDocument(row)}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
                      >
                        <FiCheckCircle className="h-4 w-4" />
                        Approve
                      </button>

                      <button
                        type="button"
                        onClick={() => handleClearDocument(row)}
                        disabled={isClearing}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isClearing ? (
                          <FiLoader className="h-4 w-4 animate-spin" />
                        ) : (
                          <FiTrash2 className="h-4 w-4" />
                        )}
                        {isClearing ? 'Clearing...' : 'Clear'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}

            {!rows.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <FiImage className="mx-auto h-8 w-8 text-slate-300" />

                  <p className="mt-3 text-sm font-black text-slate-700">
                    No document requirements found
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Add document requirements first before uploading files.
                  </p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {uploadDoc ? (
        <UploadDocumentModal
          document={uploadDoc}
          onClose={() => {
            setUploadDoc(null)
            setAlert({
              type: 'info',
              message: 'Upload cancelled.',
            })
          }}
          onSave={handleUploadSave}
        />
      ) : null}

      {showImages ? (
        <DocumentImagesModal
          documents={rows}
          onClose={() => setShowImages(false)}
        />
      ) : null}
    </section>
  )
}

export default Documents