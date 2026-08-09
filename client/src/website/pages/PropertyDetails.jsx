import { useEffect, useState } from 'react'
import { FiCalendar, FiCheckCircle, FiClock, FiCopy, FiHeart, FiMapPin, FiMaximize2, FiPlayCircle, FiShare2 } from 'react-icons/fi'
import { Link, useLocation, useParams } from 'react-router-dom'
import GalleryLightbox from '../components/GalleryLightbox'
import PageHero from '../components/PageHero'
import SectionHeading from '../components/SectionHeading'
import TrippingForm from '../components/TrippingForm'
import VisitChecklist from '../components/VisitChecklist'
import usePageMeta from '../hooks/usePageMeta'
import { getProjectBySlug } from '../data/projects'
import { useProjectPreferences } from '../context/ProjectPreferencesContext'
import { copyText } from '../utils/share'

const PropertyDetails = () => {
  const { projectSlug } = useParams()
  const project = getProjectBySlug(projectSlug)
  const location = useLocation()
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [copied, setCopied] = useState(false)
  const { isSaved, toggleSaved, markRecentlyViewed } = useProjectPreferences()

  usePageMeta({ title: project?.seoTitle || 'Property not found | D&C Prime Realty', description: project?.seoDescription || 'The requested property project could not be found.', image: project?.coverImage })

  useEffect(() => {
    if (project) markRecentlyViewed(project.slug)
  }, [project, markRecentlyViewed])

  useEffect(() => {
    if (location.hash === '#book-tripping') setTimeout(() => document.getElementById('book-tripping')?.scrollIntoView({ behavior: 'smooth' }), 80)
  }, [location.hash])

  if (!project) return <div className="mx-auto max-w-3xl px-5 py-20 text-center"><h1 className="text-[34px]">Project not found</h1><Link to="/properties" className="website-button-dark mt-6">Return to properties</Link></div>

  const saved = isSaved(project.slug)
  const shareProject = async () => {
    const shareData = { title: project.name, text: `${project.name} — ${project.location}`, url: window.location.href }
    if (navigator.share) {
      try { await navigator.share(shareData); return } catch { /* User cancelled or sharing failed. */ }
    }
    await copyText(window.location.href)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  if (project.status === 'coming_soon') {
    return (
      <>
        <PageHero eyebrow="Coming Soon" title="A new General Trias project is being prepared" description={project.overview} image={project.coverImage} location={project.location} logo={project.logo} />
        <section className="px-5 py-14 lg:px-8 lg:py-18">
          <div className="mx-auto grid max-w-[1100px] items-center gap-9 lg:grid-cols-[0.9fr_1.1fr]">
            <img src={project.coverImage} alt="General Trias project coming soon" className="w-full rounded-[20px] border border-[#ded9ce]" />
            <div>
              <SectionHeading eyebrow="Project update" title="Details and viewing schedules will be announced soon" description="The General Trias project is not yet open for booking. This page will be updated when approved information, photos and availability are ready." />
              <div className="mt-6 grid gap-3">
                {project.highlights.map((highlight, index) => <p key={highlight} className="flex items-center gap-3 rounded-xl border border-[#ded9ce] bg-white px-4 py-3 text-[13px] text-[#5f5a52]">{index === 0 ? <FiMapPin className="text-[#806014]" /> : <FiClock className="text-[#a66a16]" />} {highlight}</p>)}
              </div>
              <div className="mt-6 flex flex-wrap gap-2"><Link to="/contact-us" className="website-button-dark">Contact Us</Link><Link to="/properties" className="website-button-light">View Current Projects</Link><button type="button" onClick={() => toggleSaved(project.slug)} className="website-button-light"><FiHeart className={saved ? 'fill-current' : ''} /> {saved ? 'Saved' : 'Save update'}</button></div>
            </div>
          </div>
        </section>
      </>
    )
  }

  const quickFacts = [
    ['Status', project.statusLabel, FiCheckCircle],
    ['Location', project.location, FiMapPin],
    ['Property type', project.type, FiMaximize2],
    ['Regular tripping', 'Monday, Wednesday, Friday–Sunday', FiCalendar],
    ['Unavailable days', 'Tuesday and Thursday', FiClock],
    ['Last updated', project.lastUpdated, FiClock],
  ]

  return (
    <>
      <PageHero eyebrow="Property Project" title={project.name} description={project.overview} image={project.coverImage} location={project.location} logo={project.logo} />

      <section className="border-b border-[#e5dfd5] bg-white px-5 py-4 lg:px-8">
        <div className="mx-auto flex max-w-[1240px] flex-wrap gap-2">
          <button type="button" onClick={() => toggleSaved(project.slug)} className="website-button-light"><FiHeart className={saved ? 'fill-current' : ''} /> {saved ? 'Saved project' : 'Save project'}</button>
          <button type="button" onClick={shareProject} className="website-button-light">{copied ? <FiCopy /> : <FiShare2 />} {copied ? 'Link copied' : 'Share project'}</button>
          <Link to="#book-tripping" className="website-button-dark"><FiCalendar /> Book a Tripping</Link>
        </div>
      </section>

      <section className="px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto grid max-w-[1240px] gap-9 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <SectionHeading eyebrow="Project overview" title={`Explore ${project.name}`} description={project.overview} />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {project.highlights.map((highlight, index) => <div key={highlight} className="flex items-start gap-3 rounded-[14px] border border-[#ded9ce] bg-white p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f4ead0] text-[#806014]">{index === 0 ? <FiMapPin /> : index === 1 ? <FiMaximize2 /> : index === 2 ? <FiCheckCircle /> : <FiCalendar />}</span><p className="pt-1 text-[12px] font-semibold leading-6 text-[#57534b]">{highlight}</p></div>)}
            </div>
          </div>
          <div className="overflow-hidden rounded-[20px] border border-[#ded9ce] bg-white p-2"><img src={project.coverImage} alt={`${project.name} project in ${project.location}`} className="h-full min-h-[330px] w-full rounded-[14px] object-cover" /></div>
        </div>
      </section>

      <section className="bg-white px-5 py-12 lg:px-8">
        <div className="mx-auto max-w-[1240px]">
          <SectionHeading eyebrow="Quick information" title="What to know before your visit" description="Confirm final availability, pricing and the exact meeting point directly with the property team." />
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quickFacts.map(([label, value, Icon]) => <div key={label} className="rounded-[14px] border border-[#ded9ce] bg-[#faf9f6] p-4"><Icon className="h-5 w-5 text-[#806014]" /><p className="mt-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#7b756b]">{label}</p><p className="mt-1 text-[13px] font-semibold leading-5 text-[#2e2a24]">{value}</p></div>)}
          </div>
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-5 text-amber-900">Visit note: {project.visitNote}</p>
        </div>
      </section>

      {project.video ? <section className="bg-[#17130a] px-5 py-14 text-white lg:px-8 lg:py-18"><div className="mx-auto grid max-w-[1240px] items-center gap-9 lg:grid-cols-[0.7fr_1.3fr]"><div><SectionHeading eyebrow="Aerial project view" title="Review the location and access-road footage" description="Use the video as a visual reference, then confirm current road and site conditions during a property visit." light /><p className="mt-5 flex items-center gap-2 text-[12px] font-semibold text-[#dfbd62]"><FiPlayCircle className="h-5 w-5" /> Muted aerial preview</p></div><video controls muted playsInline poster={project.coverImage} className="aspect-video w-full rounded-[18px] border border-white/10 bg-black"><source src={project.video} type="video/mp4" /></video></div></section> : null}

      <section className="px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto max-w-[1240px]"><SectionHeading eyebrow="Project gallery" title="Project and surrounding area" description="Select an image to open the full-screen gallery. Actual conditions should be checked during a visit." /><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{project.gallery.map((image, index) => <button type="button" key={image.src} onClick={() => setLightboxIndex(index)} className={`${index === 0 ? 'sm:col-span-2 lg:col-span-2' : ''} group overflow-hidden rounded-[16px] border border-[#ded9ce] bg-white text-left`}><img src={image.src} alt={image.alt} loading="lazy" className={`${index === 0 ? 'h-[370px]' : 'h-[250px]'} w-full object-cover transition duration-700 group-hover:scale-[1.02]`} /><span className="sr-only">Open image {index + 1}</span></button>)}</div></div>
      </section>

      <section className="bg-white px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[0.68fr_1.32fr]">
          <div><SectionHeading eyebrow="Project updates" title="Current project activity" description="Only confirmed public updates are shown here. Contact the office for the latest information." /></div>
          <div className="grid gap-3">{project.progress.map((item) => <article key={`${item.date}-${item.title}`} className="grid gap-3 rounded-[14px] border border-[#ded9ce] bg-[#faf9f6] p-4 sm:grid-cols-[100px_1fr]"><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#806014]">{item.date}</p><div><h3 className="text-[17px]">{item.title}</h3><p className="mt-1 text-[12px] leading-5 text-[#6d6960]">{item.description}</p></div></article>)}</div>
        </div>
      </section>

      <section className="px-5 py-14 lg:px-8 lg:py-18"><div className="mx-auto max-w-[1100px]"><VisitChecklist compact /></div></section>

      <section className="bg-[#f1ede3] px-5 py-14 lg:px-8 lg:py-18"><div className="mx-auto grid max-w-[1240px] gap-9 lg:grid-cols-[0.72fr_1.28fr]"><div><SectionHeading eyebrow="Visit the project" title={`Book a tripping for ${project.name}`} description="Select your preferred schedule. Tuesday and Thursday are unavailable for regular property visits." /><Link to="/contact-us" className="website-button-light mt-6">Contact Us instead</Link></div><TrippingForm initialProject={project.slug} /></div></section>
      {lightboxIndex !== null ? <GalleryLightbox images={project.gallery} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} /> : null}
    </>
  )
}

export default PropertyDetails

