import { FiArrowRight, FiBriefcase, FiCheckCircle, FiMapPin, FiShield, FiTrendingUp, FiUsers } from 'react-icons/fi'
import { Link, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import PageHero from '../components/PageHero'
import SectionHeading from '../components/SectionHeading'
import StatusBadge from '../components/StatusBadge'
import usePageMeta from '../hooks/usePageMeta'
import { company } from '../data/company'
import { careerDepartments, sellerOpportunity } from '../data/careers'
import officeHoursFlyer from '../assets/office-hours-flyer.png'

const icons = [FiShield, FiUsers, FiCheckCircle, FiTrendingUp]

const AboutUs = () => {
  const location = useLocation()
  usePageMeta({ title: 'About D&C Prime Realty', description: 'Learn about D&C Prime Realty, its team, office, property projects and career opportunities.', image: '/website/images/company/office-team-collage.jpg' })

  useEffect(() => {
    if (location.hash === '#careers') {
      window.setTimeout(() => document.getElementById('careers')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    }
  }, [location.hash])

  return (
    <>
      <PageHero eyebrow="Our Company" title="D&C Prime Realty" description="Property guidance, scheduled site visits and client support for current and upcoming Cavite property projects." image="/website/images/company/office-team-collage.jpg" />

      <section className="px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto grid max-w-[1240px] items-center gap-9 lg:grid-cols-2">
          <img src="/website/images/company/office-team-collage.jpg" alt="D&C Prime Realty office, team and client activities" className="rounded-[20px] border border-[#ded9ce]" />
          <div>
            <SectionHeading eyebrow="About D&C Prime Realty" title="A Cavite real estate team focused on clear guidance" description="The team helps clients review property options, understand project information, arrange site visits and move through the inquiry process with better clarity." />
            <p className="mt-5 flex items-start gap-3 text-[13px] leading-6 text-[#666158]"><FiMapPin className="mt-1 h-4 w-4 shrink-0 text-[#806014]" /> {company.address}</p>
            <div className="mt-6 flex flex-wrap gap-2"><Link to="/sellers" className="website-button-dark">Meet Our Team <FiArrowRight /></Link><Link to="/properties" className="website-button-light">View Our Projects</Link></div>
          </div>
        </div>
      </section>

      <section className="bg-[#f1ede3] px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto grid max-w-[1180px] items-center gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <img src={officeHoursFlyer} alt="D&C Prime Realty office hours and services" className="mx-auto w-full max-w-[520px] rounded-[18px] border border-[#d7cfbf] shadow-[0_12px_38px_rgba(44,36,20,0.08)]" />
          <div>
            <SectionHeading eyebrow="Visit the office" title="Open Monday, Tuesday and Friday through Sunday" description={`Office hours are ${company.officeHours.hours}. Wednesday and Thursday are closed.`} />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[14px] border border-[#ded9ce] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#806014]">Open days</p><p className="mt-2 text-[13px] font-semibold leading-6">{company.officeHours.openDays}</p></div>
              <div className="rounded-[14px] border border-[#ded9ce] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#806014]">Office hours</p><p className="mt-2 text-[13px] font-semibold leading-6">{company.officeHours.hours}</p></div>
            </div>
            <p className="mt-4 text-[12px] leading-6 text-[#666158]">Walk-ins are welcome. For project tripping, prepare a schedule request first so the property team can confirm the date, time and meeting point.</p>
            <Link to="/properties#book-tripping" className="website-button-dark mt-6">Open Tripping Scheduler</Link>
          </div>
        </div>
      </section>

      <section className="bg-[#17130a] px-5 py-14 text-white lg:px-8 lg:py-18">
        <div className="mx-auto max-w-[1240px]">
          <SectionHeading eyebrow="Our values" title="Trust, commitment, integrity and excellence" description="These values guide how the team communicates with clients and presents property information." light align="center" />
          <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4">{company.values.map((value,index) => { const Icon=icons[index]; return <article key={value.title} className="rounded-[14px] border border-white/10 bg-white/5 p-5"><Icon className="h-5 w-5 text-[#dfbd62]" /><h3 className="mt-4 text-[17px]">{value.title}</h3><p className="mt-2 text-[12px] leading-5 text-[#d4cec2]">{value.description}</p></article>})}</div>
        </div>
      </section>

      <section className="px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto max-w-[1240px]">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><SectionHeading eyebrow="Company activities" title="Learning, partnerships and project visits" description="The team participates in professional activities and conducts site visits to review property access and project locations." /><Link to="/sellers" className="website-button-light self-start">Our Team <FiArrowRight /></Link></div>
          <div className="mt-8 grid gap-4 lg:grid-cols-2"><img src="/website/images/company/security-bank-event.jpg" alt="D&C Prime Realty team at a Security Bank business event" className="h-[360px] w-full rounded-[18px] object-cover" /><img src="/website/images/maragondon/site-visit-collage.jpg" alt="D&C Prime Realty team conducting a site visit" className="h-[360px] w-full rounded-[18px] object-cover" /></div>
        </div>
      </section>

      <section id="careers" className="scroll-mt-24 bg-[#f1ede3] px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto max-w-[1240px]">
          <SectionHeading eyebrow="Careers" title="Grow with D&C Prime Realty" description="Employee opportunities and seller accreditation are different paths. Approved openings and accreditation information are presented separately." align="center" />
          <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-[20px] border border-[#ded9ce] bg-white p-6">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4ead0] text-[#806014]"><FiBriefcase /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#806014]">Employees</p><h2 className="mt-1 text-[23px]">Job Opportunities</h2></div></div>
              <p className="mt-4 text-[12px] leading-6 text-[#69645b]">No unapproved vacancy is presented as open. When a position is approved, its description, requirements and application instructions can be published here.</p>
              <div className="mt-5 grid gap-3">{careerDepartments.map((item) => <article key={item.name} className="rounded-xl border border-[#e3ddd2] bg-[#faf9f6] p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-[16px]">{item.name}</h3><StatusBadge value="interest">{item.status}</StatusBadge></div><p className="mt-2 text-[11px] leading-5 text-[#726c63]">{item.description}</p></article>)}</div>
              <Link to="/contact-us?intent=career" className="website-button-light mt-5">Ask About Careers</Link>
            </div>

            <div className="rounded-[20px] border border-[#3b3321] bg-[#17130a] p-6 text-white">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d8b451] text-[#17130a]"><FiUsers /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#dfbd62]">Seller Network</p><h2 className="mt-1 text-[23px]">{sellerOpportunity.title}</h2></div></div>
              <p className="mt-4 text-[12px] leading-6 text-[#d6d0c5]">{sellerOpportunity.description}</p>
              <div className="mt-5 grid gap-3">{sellerOpportunity.notes.map((item) => <p key={item} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] leading-5 text-[#ddd6c9]"><FiCheckCircle className="mt-0.5 shrink-0 text-[#dfbd62]" /> {item}</p>)}</div>
              <Link to="/contact-us?intent=seller" className="website-button-gold mt-5">Ask About Accreditation <FiArrowRight /></Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export default AboutUs
