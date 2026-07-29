import PageHero from '../components/PageHero'
import usePageMeta from '../hooks/usePageMeta'

const Disclaimer = () => {
  usePageMeta({ title: 'Property Information Disclaimer | D&C Prime Realty', description: 'Read the limitations of public project images, estimates, availability and site information.' })
  return <><PageHero eyebrow="Legal" title="Property information disclaimer" description="Public project content is provided for initial review and should be confirmed before reservation." /><article className="website-prose mx-auto max-w-[780px] px-5 py-12 lg:py-16"><p className="!mt-0">Project images and videos may not reflect the current weather, road, vegetation or site conditions. Visit the property and confirm the meeting point before travelling.</p><h2>Availability and pricing</h2><p>Public pages do not display live unit inventory. Project availability, prices, discounts, fees and payment terms can change. Only the latest approved written quotation should be used for a purchase decision.</p><h2>Calculator estimates</h2><p>The payment estimator uses values entered by the visitor. It excludes charges or rules that are not entered and does not represent an offer or approved payment schedule.</p><h2>Coming-soon projects</h2><p>Coming-soon pages are announcements only. They do not confirm final project names, availability, pricing, launch dates or tripping schedules.</p></article></>
}

export default Disclaimer
