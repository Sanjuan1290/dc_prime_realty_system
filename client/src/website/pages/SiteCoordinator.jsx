import { FiAward, FiCalendar, FiMapPin, FiUsers } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import SectionHeading from '../components/SectionHeading'
import usePageMeta from '../hooks/usePageMeta'

const SiteCoordinator = () => {
  usePageMeta({ title: 'Site Coordination | D&C Prime Realty', description: 'Property-visit coordination and project guidance from D&C Prime Realty.', image: '/website/images/company/office-team-collage.jpg' })

  return (
    <>
      <PageHero eyebrow="Site Coordination" title="Property-visit coordination and project guidance" description="D&C Prime Realty supports clients and property guides with location information, visit schedules and project assistance." image="/website/images/company/office-team-collage.jpg" />
      <section className="px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto grid max-w-[1160px] items-start gap-9 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="rounded-[20px] border border-[#ded9ce] bg-[#17130a] p-7 text-white">
            <img src="/website/images/brand/dc-prime-mark.svg" alt="D&C Prime Realty" className="h-20 w-20" />
            <p className="mt-7 text-[11px] font-bold uppercase tracking-[0.18em] text-[#dfbd62]">Professional profile</p>
            <h2 className="mt-3 text-[30px] leading-[1.25]">Christopher John Sarte</h2>
            <p className="mt-3 text-[14px] font-semibold text-[#e4ded2]">CEO · REB · REA</p>
            <p className="mt-2 text-[12px] text-[#bdb6aa]">PRC Registration No. 0034891</p>
          </div>
          <div>
            <SectionHeading eyebrow="Site coordination" title="Support for buyers and the property team" description="Site coordination covers project-visit planning, location guidance and consistent assistance during client inquiries." />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">{[[FiAward,'Credentials','REB, REA and professional real estate leadership'],[FiMapPin,'Project guidance','Bailen and Maragondon project locations'],[FiCalendar,'Site visits','Coordination for available tripping schedules'],[FiUsers,'Team support','Training and support for property guides']].map(([Icon,title,text]) => <div key={title} className="rounded-[14px] border border-[#ded9ce] bg-white p-4"><Icon className="h-5 w-5 text-[#806014]" /><h3 className="mt-3 text-[17px]">{title}</h3><p className="mt-2 text-[12px] leading-5 text-[#6d6960]">{text}</p></div>)}</div>
            <Link to="/properties#book-tripping" className="website-button-dark mt-6">Request a property visit</Link>
          </div>
        </div>
      </section>
      <section className="bg-[#f1ede3] px-5 py-14 lg:px-8 lg:py-18"><div className="mx-auto max-w-[1160px]"><SectionHeading eyebrow="Professional development" title="Business learning and team coordination" description="Professional activities and project visits support the team’s client service and property guidance work." /><div className="mt-8 grid gap-4 lg:grid-cols-2"><img src="/website/images/company/security-bank-event.jpg" alt="D&C Prime Realty team attending a Security Bank business event" className="h-[340px] w-full rounded-[18px] object-cover" /><img src="/website/images/maragondon/site-visit-collage.jpg" alt="D&C Prime Realty team coordinating a project site visit" className="h-[340px] w-full rounded-[18px] object-cover" /></div></div></section>
    </>
  )
}

export default SiteCoordinator

