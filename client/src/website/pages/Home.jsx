import { FiArrowRight, FiCalendar, FiCheckCircle, FiHome, FiMapPin, FiShield, FiTrendingUp, FiUsers } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import ProjectCard from '../components/ProjectCard'
import SectionHeading from '../components/SectionHeading'
import TrippingForm from '../components/TrippingForm'
import BlogCard from '../components/BlogCard'
import FAQAccordion from '../components/FAQAccordion'
import usePageMeta from '../hooks/usePageMeta'
import { projects } from '../data/projects'
import { blogs } from '../data/blogs'
import { faqs } from '../data/faqs'
import { company } from '../data/company'

const valueIcons = [FiShield, FiUsers, FiCheckCircle, FiTrendingUp]

const Home = () => {
  usePageMeta({ title: 'D&C Prime Realty | Properties in Bailen and Maragondon', description: 'Explore D&C Prime Realty property projects in Bailen and Maragondon, Cavite, and request a scheduled property tripping.' })

  return (
    <>
      <section className="relative isolate flex min-h-[720px] items-center overflow-hidden bg-black px-5 py-24 text-white lg:px-8">
        <video className="absolute inset-0 -z-30 h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" poster="/website/images/maragondon/prime-enclave-cover.jpg">
          <source src="/website/videos/maragondon-hero.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 -z-20 bg-gradient-to-r from-black/90 via-black/60 to-black/20" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
        <div className="mx-auto w-full max-w-[1440px] pt-10">
          <div className="max-w-[820px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#f0cd68]/30 bg-black/30 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#f2d36f] backdrop-blur"><FiMapPin /> Current projects: Bailen • Maragondon</div>
            <h1 className="mt-7 text-[49px] font-black leading-[0.98] tracking-[-0.055em] sm:text-[70px] lg:text-[84px]">Find your property in Cavite.</h1>
            <p className="mt-7 max-w-2xl text-[16px] leading-8 text-[#e8e1d4] sm:text-[18px]">Explore lot options in Bailen and Maragondon with project information, property photos and guided site visits from D&amp;C Prime Realty.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/properties" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#e2b631] px-7 py-4 text-[14px] font-black text-[#18140b] transition hover:bg-[#f1cc59]">View properties <FiArrowRight /></Link>
              <Link to="/properties#book-tripping" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/35 bg-white/10 px-7 py-4 text-[14px] font-black text-white backdrop-blur transition hover:bg-white/20"><FiCalendar /> Book a Tripping</Link>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 grid border-t border-white/15 bg-black/35 backdrop-blur md:grid-cols-3">
          {[
            ['Two current locations', 'Bailen and Maragondon'],
            ['Guided site visits', 'Schedule with a property guide'],
            ['Tuesday and Thursday', 'Unavailable for regular tripping'],
          ].map(([label, value]) => <div key={label} className="border-b border-white/10 px-6 py-5 md:border-b-0 md:border-r"><p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#e7c659]">{label}</p><p className="mt-1 text-[13px] font-semibold text-white">{value}</p></div>)}
        </div>
      </section>

      <section className="px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-[1440px]">
          <SectionHeading eyebrow="Current projects" title="Property options in Bailen and Maragondon" description="Review the current project information, view the site photos and request a guided visit before making a property decision." align="center" />
          <div className="mt-12 grid gap-7 lg:grid-cols-2">{projects.map((project) => <ProjectCard key={project.slug} project={project} />)}</div>
        </div>
      </section>

      <section className="bg-[#18140b] px-5 py-20 text-white lg:px-8 lg:py-24">
        <div className="mx-auto max-w-[1440px]">
          <SectionHeading eyebrow="Why D&C Prime Realty" title="Property guidance built on clear communication" description="Our team helps clients review project information, arrange a property visit and understand the next steps before reservation." light align="center" />
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {company.values.map((value, index) => { const Icon = valueIcons[index]; return <article key={value.title} className="rounded-[22px] border border-white/10 bg-white/[0.05] p-6"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e2b631] text-[#17130a]"><Icon className="h-6 w-6" /></span><h3 className="mt-5 text-[20px] font-black">{value.title}</h3><p className="mt-3 text-[13px] leading-6 text-[#d7cfbd]">{value.description}</p></article> })}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-[1440px] items-center gap-12 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-[30px] border border-[#eadfc9] bg-white p-3 shadow-[0_25px_70px_rgba(93,69,14,0.10)]"><img src="/website/images/company/office-team-collage.jpg" alt="D&C Prime Realty team and office activities" className="w-full rounded-[22px] object-cover" /></div>
          <div>
            <SectionHeading eyebrow="About us" title="A Cavite property team focused on guided assistance" description="D&C Prime Realty assists clients looking for property options in Cavite. The team provides project information, property-viewing support and practical guidance throughout the inquiry process." />
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#eadfc9] bg-white p-5"><FiHome className="h-6 w-6 text-[#a97908]" /><p className="mt-3 text-[14px] font-black">Local project focus</p><p className="mt-2 text-[13px] leading-6 text-[#6f6654]">Current project presentation for Bailen and Maragondon.</p></div>
              <div className="rounded-2xl border border-[#eadfc9] bg-white p-5"><FiUsers className="h-6 w-6 text-[#a97908]" /><p className="mt-3 text-[14px] font-black">Guided property visits</p><p className="mt-2 text-[13px] leading-6 text-[#6f6654]">Coordinate your visit with a project guide or site coordinator.</p></div>
            </div>
            <div className="mt-7 flex flex-wrap gap-3"><Link to="/about-us" className="website-button-dark">Learn about us <FiArrowRight /></Link><Link to="/sellers" className="website-button-light">Meet the property team</Link></div>
          </div>
        </div>
      </section>

      <section className="bg-[#f4efe2] px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-[1440px] items-start gap-12 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="lg:sticky lg:top-28">
            <SectionHeading eyebrow="Property tripping" title="See the project area in person" description="Choose a current project, preferred guide and date. Tuesday and Thursday are unavailable for regular tripping appointments." />
            <div className="mt-7 space-y-4">
              {['Review actual road and site conditions', 'Ask about available units and payment options', 'Compare the written quotation with the project information'].map((item) => <p key={item} className="flex items-start gap-3 text-[14px] leading-6 text-[#5f5748]"><FiCheckCircle className="mt-1 h-5 w-5 shrink-0 text-[#2f6b3e]" /> {item}</p>)}
            </div>
          </div>
          <TrippingForm />
        </div>
      </section>

      <section className="px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-[1440px] items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <img src="/website/images/coordinator/christopher-sarte-training.jpg" alt="Christopher John Sarte, CEO and site coordinator of D&C Prime Realty" className="mx-auto max-h-[680px] w-full rounded-[30px] object-cover object-top shadow-[0_25px_70px_rgba(50,37,6,0.16)]" />
          <div>
            <SectionHeading eyebrow="Site coordinator" title="Project guidance from an experienced real estate professional" description="Meet the site coordinator for project visits, location guidance and property information." />
            <div className="mt-7 rounded-[22px] border border-[#e5dac0] bg-white p-6"><p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#9d7007]">Christopher John Sarte</p><p className="mt-2 text-[22px] font-black text-[#1b170d]">REB, REA</p><p className="mt-2 text-[13px] font-semibold text-[#6c6250]">PRC Registration No. 0034891</p></div>
            <Link to="/site-coordinator" className="website-button-dark mt-7">View coordinator profile <FiArrowRight /></Link>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-[1440px]">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><SectionHeading eyebrow="Property blog" title="Guides for buyers and property visitors" description="Read practical information about site visits, location comparison and the checks to make before reserving a lot." /><Link to="/blog" className="website-button-light self-start">View all articles <FiArrowRight /></Link></div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{blogs.map((blog) => <BlogCard key={blog.slug} blog={blog} />)}</div>
        </div>
      </section>

      <section className="px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-[1200px] gap-12 lg:grid-cols-[0.75fr_1.25fr]">
          <div><SectionHeading eyebrow="FAQs" title="Common property questions" description="Review the basic booking, project and property-visit information before contacting the team." /><Link to="/faqs" className="website-button-light mt-7">View all FAQs</Link></div>
          <FAQAccordion items={faqs.slice(0, 5)} />
        </div>
      </section>

      <section className="px-5 pb-20 lg:px-8 lg:pb-28">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-8 overflow-hidden rounded-[30px] bg-[#18140b] px-7 py-12 text-white sm:px-10 lg:flex-row lg:items-center lg:px-14">
          <div><p className="text-[12px] font-black uppercase tracking-[0.2em] text-[#e5b93f]">Need project details?</p><h2 className="mt-3 text-[34px] font-black tracking-[-0.04em] sm:text-[42px]">Talk with the D&amp;C Prime Realty team.</h2><p className="mt-4 max-w-2xl text-[14px] leading-7 text-[#d8d0bf]">Ask about current property options, project locations and available tripping schedules.</p></div>
          <div className="flex shrink-0 flex-wrap gap-3"><Link to="/contact-us" className="inline-flex h-12 items-center justify-center rounded-xl bg-[#e2b631] px-6 text-[13px] font-black text-[#17130a]">Contact Us</Link><Link to="/properties" className="inline-flex h-12 items-center justify-center rounded-xl border border-white/25 px-6 text-[13px] font-black text-white">View Properties</Link></div>
        </div>
      </section>
    </>
  )
}

export default Home
