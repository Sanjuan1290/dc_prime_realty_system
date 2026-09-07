import { useEffect, useMemo, useState } from 'react'
import { FiClock, FiColumns, FiFilter, FiMapPin, FiX } from 'react-icons/fi'
import { Link, useLocation } from 'react-router-dom'
import PageHero from '../components/PageHero'
import ProjectCard from '../components/ProjectCard'
import ProjectComparison from '../components/ProjectComparison'
import SectionHeading from '../components/SectionHeading'
import StatusBadge from '../components/StatusBadge'
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
    description: 'Explore ongoing D&C Prime Realty projects in Bailen and Maragondon, plus a General Trias project coming soon.',
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

  const ongoing = projects.filter((project) => project.status === 'available')
  const upcoming = projects.filter((project) => project.status === 'coming_soon')
  const compareProjects = compareSlugs.map((slug) => projects.find((project) => project.slug === slug)).filter(Boolean)
  const toggleCompare = (slug) => setCompareSlugs((current) => current.includes(slug) ? current.filter((item) => item !== slug) : current.length < 3 ? [...current, slug] : current)
  const clearFilters = () => { setStatus('all'); setLocationFilter('all'); setMedia('all'); setSort('availability') }
  const activeFilterCount = [status, locationFilter, media].filter((value) => value !== 'all').length

  return (
    <>
      <PageHero eyebrow="Our Projects" title="Property projects in Cavite" description="Review ongoing developments in Bailen and Maragondon and follow upcoming D&C Prime Realty locations." image="/website/images/bailen/luntiang-aguinaldo-cover.jpg" />

      <section className="px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto max-w-[1240px]">
          <SectionHeading eyebrow="Project Portfolio" title="Ongoing and upcoming developments" description="Current projects are open for property inquiries and schedule requests. Upcoming projects remain announcements until approved information is released." />
          <div className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="rounded-[20px] border border-[#ded9ce] bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3"><h2 className="text-[22px]">Ongoing Projects</h2><StatusBadge value="available">Open for inquiries</StatusBadge></div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">{ongoing.map((project) => <Link key={project.slug} to={`/properties/${project.slug}`} className="group overflow-hidden rounded-[16px] border border-[#e3ddd2] bg-[#faf9f6] transition hover:border-[#b68a1f]"><img src={project.coverImage} alt={`${project.name} in ${project.location}`} className="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.02]" /><div className="p-4"><p className="text-[15px] font-bold text-[#29251f]">{project.name}</p><p className="mt-2 flex items-center gap-2 text-[11px] text-[#746f65]"><FiMapPin className="text-[#806014]" /> {project.location}</p></div></Link>)}</div>
            </div>
            <div className="rounded-[20px] border border-[#ded9ce] bg-[#17130a] p-5 text-white sm:p-6">
              <div className="flex items-center justify-between gap-3"><h2 className="text-[22px]">Upcoming</h2><StatusBadge value="limited">Coming Soon</StatusBadge></div>
              <div className="mt-5 grid gap-4">{upcoming.map((project) => <Link key={project.slug} to={`/properties/${project.slug}`} className="rounded-[16px] border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"><img src={project.logo} alt="" className="h-11 max-w-[150px] object-contain object-left" /><p className="mt-4 text-[15px] font-bold">{project.name}</p><p className="mt-2 flex items-center gap-2 text-[11px] text-[#d4cec2]"><FiMapPin className="text-[#dfbd62]" /> {project.location}</p><p className="mt-2 flex items-center gap-2 text-[11px] text-[#bdb6aa]"><FiClock className="text-[#dfbd62]" /> Details in preparation</p></Link>)}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f1ede3] px-5 py-14 lg:px-8 lg:py-18">
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

      <section className="px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto grid max-w-[1240px] gap-9 lg:grid-cols-[0.72fr_1.28fr]">
          <div><SectionHeading eyebrow="Book a Tripping" title="Choose a project and preferred visit date" description="Choose a preferred date for Bailen or Maragondon. Wednesday and Thursday are closed, and final appointments still require confirmation from the property team." /><p className="mt-5 text-[12px] leading-6 text-[#666158]">Office hours: 9:00 AM–8:00 PM on Monday, Tuesday and Friday through Sunday.</p></div>
          <TrippingForm />
        </div>
      </section>
      {comparisonOpen ? <ProjectComparison projects={compareProjects} onClose={() => setComparisonOpen(false)} onRemove={(slug) => setCompareSlugs((current) => current.filter((item) => item !== slug))} /> : null}
    </>
  )
}

export default Properties
