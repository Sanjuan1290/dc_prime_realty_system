import { useMemo, useState } from 'react'
import { FiEye, FiImage, FiSearch, FiX } from 'react-icons/fi'

const imagePlaceholder = '/docImage1.png'

const statusStyles = {
  Approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Submitted: 'border-blue-200 bg-blue-50 text-blue-700',
  Missing: 'border-red-200 bg-red-50 text-red-700',
  Pending: 'border-amber-200 bg-amber-50 text-amber-700',
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

const DocumentImagesModal = ({ documents = [], onClose }) => {
  const [search, setSearch] = useState('')

  const filteredDocuments = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    if (!keyword) return documents

    return documents.filter((document) =>
      `${document.name} ${document.status} ${document.fileName}`
        .toLowerCase()
        .includes(keyword)
    )
  }, [documents, search])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <div>
            <h2 className="text-xl font-black text-slate-950">
              Document Images
            </h2>
            <p className="text-sm font-semibold text-slate-500">
              View document images grouped by document label.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98]"
            aria-label="Close document images"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 border-b border-slate-200 bg-slate-50 p-5">
          <label className="relative block">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search document label, file name, or status..."
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredDocuments.map((document) => {
              const images =
                document.images && document.images.length
                  ? document.images
                  : [imagePlaceholder]

              return (
                <section
                  key={document.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="border-b border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                          Label
                        </p>

                        <h3 className="mt-1 text-base font-black text-slate-950">
                          {document.name}
                        </h3>

                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          File:{' '}
                          {document.fileName && document.fileName !== '-'
                            ? document.fileName
                            : 'Using sample image for preview'}
                        </p>
                      </div>

                      <StatusPill value={document.status} />
                    </div>
                  </div>

                  <div className="p-4">
                    <p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-400">
                      Images
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {images.map((image, index) => (
                        <button
                          key={`${document.id}-${image}-${index}`}
                          type="button"
                          className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left transition hover:border-blue-300 hover:ring-4 hover:ring-blue-50 active:scale-[0.99]"
                        >
                          <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                            <img
                              src={image}
                              alt={`${document.name} preview ${index + 1}`}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-3 p-3">
                            <span className="text-xs font-black text-slate-700">
                              Image {index + 1}
                            </span>

                            <span className="inline-flex items-center gap-1 text-xs font-black text-blue-700">
                              <FiEye className="h-3.5 w-3.5" />
                              Preview
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              )
            })}
          </div>

          {!filteredDocuments.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <FiImage className="mx-auto h-10 w-10 text-slate-300" />

              <p className="mt-3 text-sm font-black text-slate-700">
                No document images found
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                Try changing your search keyword.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-200 bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default DocumentImagesModal
