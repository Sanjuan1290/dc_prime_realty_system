import { FiArrowRight, FiCalendar, FiCheckCircle, FiFileText, FiMap, FiUsers } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import SectionHeading from '../components/SectionHeading'
import usePageMeta from '../hooks/usePageMeta'
import { guidanceServices } from '../data/sellers'
import { departments, leadership } from '../data/team'

const serviceIcons = [FiMap, FiCalendar, FiFileText, FiCheckCircle]

const Sellers = () => {
  usePageMeta({ title: 'Our Team | D&C Prime Realty', description: 'Meet D&C Prime Realty leadership and learn how its departments and property guidance team support clients and project visits.' })

  return (
    <>
      <PageHero eyebrow="Our Team" title="The people behind D&C Prime Realty" description="Leadership, internal departments, site coordination and property guidance work together to support clients and project visits." image="/website/images/company/office-team-collage.jpg" />

      <section className="px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto max-w-[1180px]">
          <SectionHeading eyebrow="Leadership" title="Real estate leadership and site coordination" description="Public leadership information is shown only where confirmed company details are available." />
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {leadership.map((person) => <article key={person.name} className="overflow-hidden rounded-[20px] border border-[#ded9ce] bg-[#17130a] p-6 text-white"><img src="/website/images/brand/dc-prime-mark.svg" alt="D&C Prime Realty" className="h-16 w-16" /><p className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#dfbd62]">Leadership</p><h2 className="mt-2 text-[27px]">{person.name}</h2><p className="mt-2 text-[13px] font-semibold text-[#e4ded2]">{person.title}</p><p className="mt-1 text-[11px] text-[#bdb6aa]">{person.credential}</p><p className="mt-4 text-[12px] leading-6 text-[#d6d0c5]">{person.summary}</p><Link to={person.profileTo} className="website-button-gold mt-5">View Profile <FiArrowRight /></Link></article>)}
            <div className="rounded-[20px] border border-[#ded9ce] bg-white p-6"><SectionHeading eyebrow="How we work" title="One team across client and project support" description="Public team pages can grow from one shared data source as additional approved profiles become available." /><div className="mt-5 grid gap-3 sm:grid-cols-2">{departments.map((department) => <article key={department.name} className="rounded-xl border border-[#e3ddd2] bg-[#faf9f6] p-4"><FiUsers className="h-5 w-5 text-[#806014]" /><h3 className="mt-3 text-[16px]">{department.name}</h3><p className="mt-2 text-[11px] leading-5 text-[#726c63]">{department.description}</p></article>)}</div></div>
          </div>
        </div>
      </section>

      <section className="bg-[#f1ede3] px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto max-w-[1180px]">
          <SectionHeading eyebrow="Property Guidance" title="Support through each stage of a property inquiry" description="The property guidance team helps visitors review project information and prepare for site visits. Specific seller profiles can be added later when approved for public display." align="center" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{guidanceServices.map((service, index) => { const Icon = serviceIcons[index]; return <article key={service.title} className="rounded-[16px] border border-[#ded9ce] bg-white p-5"><Icon className="h-5 w-5 text-[#806014]" /><h2 className="mt-4 text-[18px]">{service.title}</h2><p className="mt-2 text-[12px] leading-5 text-[#6d6960]">{service.description}</p></article> })}</div>
        </div>
      </section>

      <section className="px-5 py-14 lg:px-8 lg:py-18"><div className="mx-auto grid max-w-[1120px] items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]"><img src="/website/images/maragondon/site-visit-collage.jpg" alt="D&C Prime Realty team during a property site visit" className="rounded-[18px] border border-[#ded9ce]" /><div><SectionHeading eyebrow="Site coordination" title="Bailen, Maragondon and future project support" description="The team currently supports visitors for Luntiang Aguinaldo and Prime Enclave. General Trias information will be published when approved details become available." /><div className="mt-5 space-y-2 text-[13px] text-[#5f5b53]"><p className="flex items-center gap-2"><FiUsers className="text-[#806014]" /> Bailen property assistance</p><p className="flex items-center gap-2"><FiUsers className="text-[#806014]" /> Maragondon property assistance</p><p className="flex items-center gap-2"><FiUsers className="text-[#a66a16]" /> General Trias project updates</p></div><Link to="/properties#book-tripping" className="website-button-dark mt-6"><FiCalendar /> Open Tripping Scheduler</Link></div></div></section>
    </>
  )
}

export default Sellers
