import { FiCheckCircle, FiMapPin, FiShield, FiTrendingUp, FiUsers } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import SectionHeading from '../components/SectionHeading'
import usePageMeta from '../hooks/usePageMeta'
import { company } from '../data/company'

const icons = [FiShield, FiUsers, FiCheckCircle, FiTrendingUp]

const AboutUs = () => {
  usePageMeta({ title: 'About D&C Prime Realty', description: 'Learn about D&C Prime Realty, its property guidance services and current projects in Bailen and Maragondon, Cavite.', image: '/website/images/company/office-team-collage.jpg' })
  return (
    <>
      <PageHero eyebrow="About Us" title="Building relationships through practical property guidance" description="D&C Prime Realty assists clients who want to review property options, visit project sites and understand the inquiry and reservation process." image="/website/images/company/office-team-collage.jpg" />
      <section className="px-5 py-20 lg:px-8 lg:py-24"><div className="mx-auto grid max-w-[1440px] items-center gap-12 lg:grid-cols-2"><img src="/website/images/company/office-team-collage.jpg" alt="D&C Prime Realty office, team and client activities" className="rounded-[28px] shadow-[0_25px_70px_rgba(64,47,9,0.13)]" /><div><SectionHeading eyebrow="Our company" title="A property team serving clients in Cavite" description="The team provides project information, property-viewing assistance and coordination for clients reviewing current property options in Bailen and Maragondon." /><p className="mt-6 flex items-start gap-3 text-[14px] leading-7 text-[#665e4e]"><FiMapPin className="mt-1 h-5 w-5 shrink-0 text-[#9d7007]" /> {company.address}</p><Link to="/contact-us" className="website-button-dark mt-7">Contact the team</Link></div></div></section>
      <section className="bg-[#17130a] px-5 py-20 text-white lg:px-8 lg:py-24"><div className="mx-auto max-w-[1440px]"><SectionHeading eyebrow="Our values" title="Trust, commitment, integrity and excellence" description="These values guide how the team communicates with clients, coordinates property visits and presents project information." light align="center" /><div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{company.values.map((value,index) => { const Icon=icons[index]; return <article key={value.title} className="rounded-[22px] border border-white/10 bg-white/5 p-6"><Icon className="h-7 w-7 text-[#e7be48]" /><h3 className="mt-5 text-[20px] font-black">{value.title}</h3><p className="mt-3 text-[13px] leading-6 text-[#d6cebd]">{value.description}</p></article>})}</div></div></section>
      <section className="px-5 py-20 lg:px-8 lg:py-24"><div className="mx-auto max-w-[1440px]"><SectionHeading eyebrow="Company activities" title="Learning, partnerships and project visits" description="The team participates in professional activities and conducts site visits to review project locations and property access." /><div className="mt-10 grid gap-5 lg:grid-cols-2"><img src="/website/images/company/security-bank-event.jpg" alt="D&C Prime Realty team at a Security Bank business event" className="h-[420px] w-full rounded-[24px] object-cover" /><img src="/website/images/maragondon/site-visit-collage.jpg" alt="D&C Prime Realty team conducting a site visit" className="h-[420px] w-full rounded-[24px] object-cover" /></div></div></section>
      <section className="bg-[#f4efe2] px-5 py-20 lg:px-8"><div className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-[0.6fr_1.4fr]"><img src="/website/images/company/proverbs-16-3.jpg" alt="Commit to the Lord whatever you do, Proverbs 16:3" className="mx-auto max-h-[420px] rounded-[24px] object-cover shadow-lg" /><div><SectionHeading eyebrow="Company principle" title="Plans supported by purpose and responsible work" description="The company values thoughtful planning, dependable service and respectful relationships with clients, sellers and project partners." /><Link to="/properties" className="website-button-dark mt-7">View current projects</Link></div></div></section>
    </>
  )
}

export default AboutUs
