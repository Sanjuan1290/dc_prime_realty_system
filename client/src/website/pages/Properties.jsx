import { useEffect, useMemo, useState } from 'react'
import { FiColumns, FiFilter, FiX } from 'react-icons/fi'
import { useLocation } from 'react-router-dom'
import PageHero from '../components/PageHero'
import ProjectCard from '../components/ProjectCard'
import ProjectComparison from '../components/ProjectComparison'
import SectionHeading from '../components/SectionHeading'
import TrippingForm from '../components/TrippingForm'
import usePageMeta from '../hooks/usePageMeta'
import { projects } from '../data/projects'

const Properties = () => {
  const [status, setStatus] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [media, setMedia] = useState('all')
  const [sort, setSort] = useState('availability')
  const [compareSlugs, setCompareSlugs] = useState([])
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const location = useLocation()

  usePageMeta({
    title: 'Properties in Bailen, Maragondon and General Trias | D&C Prime Realty',
    description: 'Compare available D&C Prime Realty projects in Bailen and Maragondon, plus a General Trias project coming soon.',
  })

  useEffect(() => {
    if (location.hash === '#book-tripping') setTimeout(() => document.getElementById('book-tripping')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }, [location.hash])

  const filtered = useMemo(() => {
    const result = projects.filter((project) => {
      if (status !== 'all' && project.status !== status) return false
      if (locationFilter !== 'all' && project.slug !== locationFilter) return false
      if (media === 'video' && !project.video) return false
      if (media === 'photos' && !project.gallery?.length) return false
      return true
    })

    return [...result].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'location') return a.location.localeCompare(b.location)
      if (sort === 'updated') return b.lastUpdated.localeCompare(a.lastUpdated)
      return Number(b.bookingEnabled) - Number(a.bookingEnabled)
    })
  }, [status, locationFilter, media, sort])

  const compareProjects = compareSlugs.map((slug) => projects.find((project) => project.slug === slug)).filter(Boolean)
  const toggleCompare = (slug) => setCompareSlugs((current) => current.includes(slug) ? current.filter((item) => item !== slug) : current.length < 3 ? [...current, slug] : current)
  const clearFilters = () => { setStatus('all'); setLocationFilter('all'); setMedia('all'); setSort('availability') }
  const activeFilterCount = [status, locationFilter, media].filter((value) => value !== 'all').length

  return (
    <>
      <PageHero eyebrow="Properties" title="Property projects in Cavite" description="Filter and compare available projects in Bailen and Maragondon, with a new General Trias location coming soon." image="/website/images/bailen/luntiang-aguinaldo-cover.jpg" />
      <section className="px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto max-w-[1280px]">
          <div className="rounded-[18px] border border-[#ded9ce] bg-white p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label><span className="website-label">Status</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="website-input"><option value="all">All statuses</option><option value="available">Available</option><option value="coming_soon">Coming Soon</option></select></label>
                <label><span className="website-label">Location</span><select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="website-input"><option value="all">All locations</option>{projects.map((project) => <option key={project.slug} value={project.slug}>{project.shortName}</option>)}</select></label>
                <label><span className="website-label">Media</span><select value={media} onChange={(event) => setMedia(event.target.value)} className="website-input"><option value="all">All media</option><option value="photos">With project photos</option><option value="video">With aerial video</option></select></label>
                <label><span className="website-label">Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)} className="website-input"><option value="availability">Available first</option><option value="name">Project name</option><option value="location">Location</option><option value="updated">Recently updated</option></select></label>
              </div>
              <button type="button" onClick={clearFilters} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] border border-[#ded9ce] px-4 text-[12px] font-semibold text-[#625e56] hover:bg-[#f8f6f0]"><FiX /> Clear {activeFilterCount ? `(${activeFilterCount})` : ''}</button>
            </div>
          </div>

          <div className="mt-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <p className="flex items-center gap-2 text-[12px] text-[#6d6960]"><FiFilter /> Showing {filtered.length} of {projects.length} projects</p>
            <button type="button" onClick={() => compareSlugs.length && setComparisonOpen(true)} disabled={!compareSlugs.length} className="website-button-light disabled:cursor-not-allowed disabled:opacity-50"><FiColumns /> Compare selected ({compareSlugs.length}/3)</button>
          </div>

          {compareSlugs.length === 3 ? <p className="mt-3 text-[11px] text-[#a66a16]">You can compare up to three projects. Remove one before selecting another.</p> : null}
          <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.map((project) => <ProjectCard key={project.slug} project={project} compareSelected={compareSlugs.includes(project.slug)} onCompare={toggleCompare} />)}</div>
          {!filtered.length ? <div className="mt-7 rounded-[18px] border border-dashed border-[#cfc8bb] bg-white p-10 text-center"><h2 className="text-[23px]">No projects match these filters</h2><button type="button" onClick={clearFilters} className="website-button-dark mt-5">Reset filters</button></div> : null}
        </div>
      </section>
      <section className="bg-[#f1ede3] px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto grid max-w-[1240px] gap-9 lg:grid-cols-[0.72fr_1.28fr]">
          <SectionHeading eyebrow="Book a Tripping" title="Choose an available project and visit date" description="Bailen and Maragondon are open for tripping requests. Tuesday and Thursday are unavailable for regular visits." />
          <TrippingForm />
        </div>
      </section>
      {comparisonOpen ? <ProjectComparison projects={compareProjects} onClose={() => setComparisonOpen(false)} onRemove={(slug) => setCompareSlugs((current) => current.filter((item) => item !== slug))} /> : null}
    </>
  )
}

export default Properties
