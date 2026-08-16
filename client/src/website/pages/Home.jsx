import { useRef, useState } from 'react'
import { FiArrowRight, FiCalendar, FiCheckCircle, FiFacebook, FiMail, FiMapPin, FiPause, FiPlay, FiShield, FiTrendingUp, FiUsers } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import BlogCard from '../components/BlogCard'
import BuyerProcess from '../components/BuyerProcess'
import FAQAccordion from '../components/FAQAccordion'
import ProjectCard from '../components/ProjectCard'
import RecentlyViewed from '../components/RecentlyViewed'
import SectionHeading from '../components/SectionHeading'
import TrippingForm from '../components/TrippingForm'
import usePageMeta from '../hooks/usePageMeta'
import { projects } from '../data/projects'
import { blogs } from '../data/blogs'
import { faqs } from '../data/faqs'
import { company } from '../data/company'

const valueIcons = [FiShield, FiUsers, FiCheckCircle, FiTrendingUp]

const Home = () => {
  const videoRef = useRef(null)
  const [videoPaused, setVideoPaused] = useState(false)

  usePageMeta({
    title: 'D&C Prime Realty | Cavite Property Projects',
    description: 'View available property projects in Bailen and Maragondon, with a new General Trias project coming soon.',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'RealEstateAgent',
      name: company.name,
      email: company.email,
      address: company.address,
      areaServed: company.serviceArea,
      sameAs: [company.facebookUrl],
    },
  })

  const toggleVideo = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().catch(() => {})
      setVideoPaused(false)
    } else {
      video.pause()
      setVideoPaused(true)
    }
  }

  return (
    <>
      <section id="home-video-hero" className="relative isolate flex min-h-[520px] items-center overflow-hidden bg-black px-5 py-16 pt-[96px] text-white sm:min-h-[560px] lg:min-h-[600px] lg:px-8 lg:pt-[104px]">
        <video ref={videoRef} className="absolute inset-0 -z-30 h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" poster="/website/images/maragondon/prime-enclave-cover.jpg">
          <source src="/website/videos/maragondon-hero.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 -z-20 bg-gradient-to-r from-black/90 via-black/62 to-black/20" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/60 via-transparent to-black/15" />
        <button type="button" onClick={toggleVideo} className="absolute bottom-4 right-4 z-10 inline-flex min-h-[40px] items-center gap-2 rounded-full border border-white/25 bg-black/30 px-4 text-[11px] font-semibold text-white backdrop-blur hover:bg-black/50" aria-label={videoPaused ? 'Play background video' : 'Pause background video'}>{videoPaused ? <FiPlay /> : <FiPause />} {videoPaused ? 'Play video' : 'Pause video'}</button>
        <div className="mx-auto w-full max-w-[1280px]">
          <div className="max-w-[740px]">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#d9b455]/40 bg-black/25 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#e4c76f] backdrop-blur"><FiMapPin /> Current projects in Cavite</p>
            <h1 className="mt-6 text-[40px] leading-[1.12] sm:text-[50px] xl:text-[60px]">Property options for your plans in Cavite.</h1>
            <p className="mt-5 max-w-[650px] text-[14px] leading-7 text-[#e3ddd2] sm:text-[16px]">Explore available lots in Bailen and Maragondon, with a new General Trias project coming soon.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link to="/properties" className="website-button-gold">View Properties <FiArrowRight /></Link>
              <Link to="/properties#book-tripping" className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] border border-white/30 bg-white/10 px-5 text-[13px] font-bold text-white backdrop-blur transition hover:bg-white/20"><FiCalendar /> Book a Tripping</Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-2">
              {projects.map((project) => <span key={project.slug} className="rounded-full border border-white/20 bg-black/25 px-3 py-1.5 text-[11px] font-semibold text-[#f1eee8]">{project.shortName} <span className={project.status === 'coming_soon' ? 'text-[#e7bd63]' : 'text-[#9ed0aa]'}>• {project.statusLabel}</span></span>)}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto max-w-[1280px]">
          <SectionHeading eyebrow="Featured projects" title="Current and upcoming property locations" description="Review project information, save your preferred options and compare the locations before arranging a visit." align="center" />
          <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <ProjectCard key={project.slug} project={project} />)}</div>
          <div className="mt-6 flex justify-center"><Link to="/properties" className="website-button-light">Compare all projects <FiArrowRight /></Link></div>
        </div>
      </section>

      <section className="bg-white px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto grid max-w-[1240px] items-center gap-10 lg:grid-cols-[1fr_1.05fr]">
          <div className="overflow-hidden rounded-[20px] border border-[#ded9ce] bg-[#f8f6f0] p-2"><img src="/website/images/company/office-team-collage.jpg" alt="D&C Prime Realty team and office activities" className="w-full rounded-[15px] object-cover" /></div>
          <div>
            <SectionHeading eyebrow="About D&C Prime Realty" title="Property guidance based on clear communication" description="D&C Prime Realty assists clients reviewing property options in Cavite through project information, site-visit coordination and practical support before reservation." />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {company.values.map((value, index) => { const Icon = valueIcons[index]; return <article key={value.title} className="rounded-[14px] border border-[#e2ddd3] bg-[#faf9f6] p-4"><Icon className="h-5 w-5 text-[#806014]" /><h3 className="mt-3 text-[17px] text-[#1b1813]">{value.title}</h3><p className="mt-2 text-[12px] leading-5 text-[#6d6960]">{value.description}</p></article> })}
            </div>
            <Link to="/about-us" className="website-button-dark mt-6">About the company <FiArrowRight /></Link>
          </div>
        </div>
      </section>

      <section className="px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto max-w-[1240px]">
          <SectionHeading eyebrow="Buyer process" title="A clearer way to review a property" description="Use these steps as a guide. Confirm all project and payment information before making a reservation." align="center" />
          <div className="mt-8"><BuyerProcess /></div>
        </div>
      </section>

      <section className="bg-[#f1ede3] px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto grid max-w-[1240px] items-start gap-9 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="lg:sticky lg:top-24">
            <SectionHeading eyebrow="Property tripping" title="See the project area in person" description="Choose an available project and preferred schedule. Tuesday and Thursday are unavailable for regular visits." />
            <div className="mt-6 space-y-3">
              {['Review actual road and site conditions', 'Ask about current property options', 'Compare the written quotation with project information'].map((item) => <p key={item} className="flex items-start gap-3 text-[13px] leading-6 text-[#5f5b53]"><FiCheckCircle className="mt-1 h-4 w-4 shrink-0 text-[#356447]" /> {item}</p>)}
            </div>
            <Link to="/visit-checklist" className="website-button-light mt-6">Open visit checklist</Link>
          </div>
          <TrippingForm />
        </div>
      </section>

      <section className="px-5 py-14 lg:px-8"><div className="mx-auto max-w-[1240px]"><RecentlyViewed /></div></section>

      <section className="px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto max-w-[1240px]">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><SectionHeading eyebrow="Property blog" title="Useful guides for buyers and visitors" description="Read practical information about site visits, location comparison and checks to make before reserving a lot." /><Link to="/blog" className="website-button-light self-start">View all articles <FiArrowRight /></Link></div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{blogs.map((blog) => <BlogCard key={blog.slug} blog={blog} />)}</div>
        </div>
      </section>

      <section className="bg-white px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto grid max-w-[1120px] gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <div><SectionHeading eyebrow="FAQs" title="Common property questions" description="Review booking, project and property-visit information before contacting the team." /><Link to="/faqs" className="website-button-light mt-6">View all FAQs</Link></div>
          <FAQAccordion items={faqs.slice(0, 4)} />
        </div>
      </section>

      <section className="px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto grid max-w-[1240px] overflow-hidden rounded-[20px] border border-[#ded9ce] bg-[#17130a] text-white lg:grid-cols-[0.82fr_1.18fr]">
          <div className="p-7 sm:p-9">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d8b451]">Contact D&C Prime Realty</p>
            <h2 className="mt-3 text-[28px] leading-[1.25] sm:text-[32px]">Ask about current projects and viewing schedules.</h2>
            <p className="mt-4 text-[13px] leading-6 text-[#d5cfc4]">Contact the team for available property information, payment samples and site-visit assistance.</p>
            <div className="mt-6 flex flex-wrap gap-2"><a href={`mailto:${company.email}`} className="website-button-gold"><FiMail /> Email us</a><a href={company.facebookUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] border border-white/25 px-5 text-[13px] font-bold text-white"><FiFacebook /> Facebook</a></div>
          </div>
          <div className="website-map min-h-[340px] bg-[#e9e4d9]"><iframe src={company.mapEmbedUrl} title="D&C Prime Realty office location on Google Maps" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>
        </div>
      </section>
    </>
  )
}

export default Home
