import { FiCalendar, FiCheckCircle, FiFileText, FiMap, FiUsers } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import SectionHeading from '../components/SectionHeading'
import usePageMeta from '../hooks/usePageMeta'
import { guidanceServices } from '../data/sellers'

const serviceIcons = [FiMap, FiCalendar, FiFileText, FiCheckCircle]

const Sellers = () => {
  usePageMeta({ title: 'Property Guidance Team | D&C Prime Realty', description: 'Learn how the D&C Prime Realty property guidance team assists clients with project information and site visits.' })

  return (
    <>
      <PageHero eyebrow="Property Guidance Team" title="Support for property inquiries and site visits" description="The D&C Prime Realty team helps clients review project information, arrange visits and understand the next steps before reservation." image="/website/images/company/office-team-collage.jpg" />
      <section className="px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto max-w-[1180px]">
          <SectionHeading eyebrow="How the team can assist" title="Property guidance for each stage of your inquiry" description="An available team member can assist after your project, date and contact details are reviewed by the office." align="center" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{guidanceServices.map((service, index) => { const Icon = serviceIcons[index]; return <article key={service.title} className="rounded-[16px] border border-[#ded9ce] bg-white p-5"><Icon className="h-5 w-5 text-[#806014]" /><h2 className="mt-4 text-[18px]">{service.title}</h2><p className="mt-2 text-[12px] leading-5 text-[#6d6960]">{service.description}</p></article> })}</div>
        </div>
      </section>
      <section className="bg-[#f1ede3] px-5 py-14 lg:px-8 lg:py-18"><div className="mx-auto grid max-w-[1120px] items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]"><img src="/website/images/maragondon/site-visit-collage.jpg" alt="D&C Prime Realty property guidance team during a site visit" className="rounded-[18px] border border-[#ded9ce]" /><div><SectionHeading eyebrow="Current project support" title="Assistance for Bailen, Maragondon and future projects" description="The team currently assists visitors for Luntiang Aguinaldo and Prime Enclave. General Trias updates will be posted when approved project information becomes available." /><div className="mt-5 space-y-2 text-[13px] text-[#5f5b53]"><p className="flex items-center gap-2"><FiUsers className="text-[#806014]" /> Bailen property assistance</p><p className="flex items-center gap-2"><FiUsers className="text-[#806014]" /> Maragondon property assistance</p><p className="flex items-center gap-2"><FiUsers className="text-[#a66a16]" /> General Trias project updates</p></div><Link to="/properties#book-tripping" className="website-button-dark mt-6"><FiCalendar /> Request a property guide</Link></div></div></section>
    </>
  )
}

export default Sellers

