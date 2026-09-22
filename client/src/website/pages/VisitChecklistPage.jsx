import PageHero from '../components/PageHero'
import VisitChecklist from '../components/VisitChecklist'
import usePageMeta from '../hooks/usePageMeta'

const VisitChecklistPage = () => {
  usePageMeta({ title: 'Property Visit Checklist | D&C Prime Realty', description: 'Prepare for a property tripping in Cavite with this printable site-visit checklist.' })
  return <><PageHero eyebrow="Buyer Resource" title="Property visit checklist" description="Prepare your questions, documents and site-inspection notes before travelling to the project." image="/website/images/bailen/site-road.jpg" /><section className="px-5 py-14 lg:px-8 lg:py-18"><div className="mx-auto max-w-[980px]"><VisitChecklist /></div></section></>
}

export default VisitChecklistPage


