import { FiCheckCircle, FiMapPin, FiShield, FiTrendingUp, FiUsers } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import SectionHeading from '../components/SectionHeading'
import usePageMeta from '../hooks/usePageMeta'
import { company } from '../data/company'

const icons = [FiShield, FiUsers, FiCheckCircle, FiTrendingUp]

const AboutUs = () => {
  usePageMeta({ title: 'About D&C Prime Realty', description: 'Learn about D&C Prime Realty, its property guidance services and Cavite property projects.', image: '/website/images/company/office-team-collage.jpg' })

  return (
    <>
      <PageHero eyebrow="About Us" title="Property guidance built around clear information" description="D&C Prime Realty helps clients review property options, visit project sites and understand the inquiry and reservation process." image="/website/images/company/office-team-collage.jpg" />
      <section className="px-5 py-14 lg:px-8 lg:py-18"><div className="mx-auto grid max-w-[1240px] items-center gap-9 lg:grid-cols-2"><img src="/website/images/company/office-team-collage.jpg" alt="D&C Prime Realty office, team and client activities" className="rounded-[20px] border border-[#ded9ce]" /><div><SectionHeading eyebrow="Our company" title="A Cavite property team focused on client assistance" description="The team provides project information, property-viewing assistance and coordination for clients reviewing property options in Bailen, Maragondon and future locations." /><p className="mt-5 flex items-start gap-3 text-[13px] leading-6 text-[#666158]"><FiMapPin className="mt-1 h-4 w-4 shrink-0 text-[#806014]" /> {company.address}</p><Link to="/contact-us" className="website-button-dark mt-6">Contact the team</Link></div></div></section>
      <section className="bg-[#17130a] px-5 py-14 text-white lg:px-8 lg:py-18"><div className="mx-auto max-w-[1240px]"><SectionHeading eyebrow="Our values" title="Trust, commitment, integrity and excellence" description="These values guide how the team communicates with clients and presents property information." light align="center" /><div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4">{company.values.map((value,index) => { const Icon=icons[index]; return <article key={value.title} className="rounded-[14px] border border-white/10 bg-white/5 p-5"><Icon className="h-5 w-5 text-[#dfbd62]" /><h3 className="mt-4 text-[17px]">{value.title}</h3><p className="mt-2 text-[12px] leading-5 text-[#d4cec2]">{value.description}</p></article>})}</div></div></section>
      <section className="px-5 py-14 lg:px-8 lg:py-18"><div className="mx-auto max-w-[1240px]"><SectionHeading eyebrow="Company activities" title="Learning, partnerships and project visits" description="The team participates in professional activities and conducts site visits to review property access and project locations." /><div className="mt-8 grid gap-4 lg:grid-cols-2"><img src="/website/images/company/security-bank-event.jpg" alt="D&C Prime Realty team at a Security Bank business event" className="h-[360px] w-full rounded-[18px] object-cover" /><img src="/website/images/maragondon/site-visit-collage.jpg" alt="D&C Prime Realty team conducting a site visit" className="h-[360px] w-full rounded-[18px] object-cover" /></div></div></section>
      <section className="bg-[#f1ede3] px-5 py-14 lg:px-8"><div className="mx-auto grid max-w-[1100px] items-center gap-8 lg:grid-cols-[0.5fr_1.5fr]"><img src="/website/images/company/proverbs-16-3.jpg" alt="Commit to the Lord whatever you do, Proverbs 16:3" className="mx-auto max-h-[340px] rounded-[18px] object-cover" /><div><SectionHeading eyebrow="Company principle" title="Responsible planning and dependable service" description="The company values thoughtful planning, respectful relationships and clear support for clients and project partners." /><Link to="/properties" className="website-button-dark mt-6">View property projects</Link></div></div></section>
    </>
  )
}

export default AboutUs
