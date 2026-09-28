import { useEffect } from 'react'
import { FiCheckCircle, FiClock, FiMapPin, FiX } from 'react-icons/fi'
import { Link } from 'react-router-dom'

const comparisonRows = [
  ['Location', (project) => project.location],
  ['Status', (project) => project.statusLabel],
  ['Property type', (project) => project.type],
  ['Tripping', (project) => project.bookingEnabled ? 'Available by schedule' : 'Not yet open'],
  ['Media', (project) => project.video ? 'Photos and aerial video' : project.gallery?.length ? 'Project photos' : 'Announcement only'],
  ['Last updated', (project) => project.lastUpdated || 'Not stated'],
]

const ProjectComparison = ({ projects, onClose, onRemove }) => {
  useEffect(() => {
    const handleKey = (event) => { if (event.key === 'Escape') onClose() }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', handleKey) }
  }, [onClose])

  if (!projects.length) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="comparison-title">
      <div className="max-h-[92vh] w-full max-w-[1100px] overflow-hidden rounded-t-[22px] bg-white shadow-2xl sm:rounded-[22px]">
        <div className="flex items-start justify-between gap-4 border-b border-[#e4ded3] px-5 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#806014]">Project comparison</p>
            <h2 id="comparison-title" className="mt-1 text-[24px] text-[#1b1813]">Compare selected projects</h2>
            <p className="mt-1 text-[12px] text-[#6d6960]">Review location, status, media and tripping availability side by side.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#ded9ce] text-[#5e5951] hover:bg-[#f8f6f0]" aria-label="Close comparison"><FiX /></button>
        </div>

        <div className="overflow-auto p-5 sm:p-6">
          <div className="min-w-[720px]">
            <div className="grid gap-3" style={{ gridTemplateColumns: `160px repeat(${projects.length}, minmax(180px, 1fr))` }}>
              <div />
              {projects.map((project) => (
                <div key={project.slug} className="rounded-[14px] border border-[#ded9ce] bg-[#faf9f6] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <img src={project.logo} alt={`${project.name} logo`} className="h-10 min-w-0 flex-1 object-contain object-left" />
                    <button type="button" onClick={() => onRemove(project.slug)} className="text-[11px] font-semibold text-[#806014] hover:underline">Remove</button>
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-[11px] text-[#6b665e]"><FiMapPin /> {project.shortName}</p>
                </div>
              ))}

              {comparisonRows.map(([label, getValue]) => (
                <div key={label} className="contents">
                  <div className="border-b border-[#e7e1d7] py-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[#6d6960]">{label}</div>
                  {projects.map((project) => (
                    <div key={`${project.slug}-${label}`} className="border-b border-[#e7e1d7] py-4 text-[12px] leading-5 text-[#3d3933]">
                      {label === 'Status' ? <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${project.bookingEnabled ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{project.bookingEnabled ? <FiCheckCircle /> : <FiClock />}{getValue(project)}</span> : getValue(project)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-[#e4ded3] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="website-button-light">Continue browsing</button>
          <Link to="/visit-checklist" className="website-button-dark">Open visit checklist</Link>
        </div>
      </div>
    </div>
  )
}

export default ProjectComparison


