import { useEffect } from 'react'
import { FiCalendar, FiCheckCircle, FiMapPin, FiMaximize2, FiPlayCircle } from 'react-icons/fi'
import { Link, useLocation, useParams } from 'react-router-dom'
import PageHero from '../components/PageHero'
import SectionHeading from '../components/SectionHeading'
import TrippingForm from '../components/TrippingForm'
import usePageMeta from '../hooks/usePageMeta'
import { getProjectBySlug } from '../data/projects'

const PropertyDetails = () => {
  const { projectSlug } = useParams()
  const project = getProjectBySlug(projectSlug)
  const location = useLocation()

  usePageMeta({ title: project?.seoTitle || 'Property not found | D&C Prime Realty', description: project?.seoDescription || 'The requested property project could not be found.', image: project?.coverImage })
  useEffect(() => { if (location.hash === '#book-tripping') setTimeout(() => document.getElementById('book-tripping')?.scrollIntoView({ behavior: 'smooth' }), 80) }, [location.hash])

  if (!project) return <div className="mx-auto max-w-3xl px-5 py-24 text-center"><h1 className="text-[40px] font-black">Project not found</h1><Link to="/properties" className="website-button-dark mt-7">Return to properties</Link></div>

  return (
    <>
      <PageHero eyebrow="Property project" title={project.name} description={project.overview} image={project.coverImage} location={project.location} />
      <section className="px-5 py-16 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-[1440px] gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <SectionHeading eyebrow="Project overview" title={`Explore ${project.name}`} description={project.overview} />
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {project.highlights.map((highlight, index) => <div key={highlight} className="flex items-start gap-3 rounded-2xl border border-[#e7dcc3] bg-white p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff1bd] text-[#9d7007]">{index === 0 ? <FiMapPin /> : index === 1 ? <FiMaximize2 /> : index === 2 ? <FiCheckCircle /> : <FiCalendar />}</span><p className="pt-2 text-[13px] font-bold leading-6 text-[#554c3d]">{highlight}</p></div>)}
            </div>
          </div>
          <div className="overflow-hidden rounded-[28px] border border-[#e7dcc3] bg-white p-3 shadow-[0_22px_65px_rgba(93,69,14,0.09)]"><img src={project.coverImage} alt={`${project.name} project in ${project.location}`} className="h-full min-h-[360px] w-full rounded-[20px] object-cover" /></div>
        </div>
      </section>

      {project.video ? <section className="bg-[#17130a] px-5 py-16 text-white lg:px-8 lg:py-20"><div className="mx-auto grid max-w-[1440px] items-center gap-10 lg:grid-cols-[0.72fr_1.28fr]"><div><SectionHeading eyebrow="Aerial project view" title="See the location and access-road footage" description="The video provides an aerial overview of the Maragondon project area. Confirm current road and site conditions during an actual visit." light /><p className="mt-6 flex items-center gap-2 text-[13px] font-bold text-[#e8c658]"><FiPlayCircle className="h-5 w-5" /> Muted aerial preview</p></div><video controls muted playsInline poster={project.coverImage} className="aspect-video w-full rounded-[24px] border border-white/10 bg-black shadow-2xl"><source src={project.video} type="video/mp4" /></video></div></section> : null}

      <section className="px-5 py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-[1440px]"><SectionHeading eyebrow="Project gallery" title="Review the project and surrounding area" description="Images provide a visual guide. Actual site conditions should be checked during a scheduled property visit." /><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{project.gallery.map((image, index) => <figure key={image.src} className={`${index === 0 ? 'sm:col-span-2 lg:col-span-2' : ''} overflow-hidden rounded-[22px] border border-[#eadfc8] bg-white`}><img src={image.src} alt={image.alt} loading="lazy" className={`${index === 0 ? 'h-[430px]' : 'h-[290px]'} w-full object-cover transition duration-700 hover:scale-[1.03]`} /></figure>)}</div></div>
      </section>

      <section className="bg-[#f4efe2] px-5 py-20 lg:px-8 lg:py-24"><div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[0.72fr_1.28fr]"><div><SectionHeading eyebrow="Visit the project" title={`Book a tripping for ${project.name}`} description="Select your preferred schedule. Tuesday and Thursday are unavailable for regular property visits." /><Link to="/contact-us" className="website-button-light mt-7">Contact Us instead</Link></div><TrippingForm initialProject={project.slug} /></div></section>
    </>
  )
}

export default PropertyDetails
