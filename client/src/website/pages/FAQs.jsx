import FAQAccordion from '../components/FAQAccordion'
import PageHero from '../components/PageHero'
import SectionHeading from '../components/SectionHeading'
import usePageMeta from '../hooks/usePageMeta'
import { faqs } from '../data/faqs'

const FAQs = () => { usePageMeta({ title: 'Property FAQs | D&C Prime Realty', description: 'Read common questions about D&C Prime Realty projects, property tripping and public property information.' }); return <><PageHero eyebrow="FAQs" title="Answers to common property questions" description="Review the basic project, visit and booking information before contacting the team." image="/website/images/maragondon/site-visit-collage.jpg" /><section className="px-5 py-20 lg:px-8 lg:py-24"><div className="mx-auto grid max-w-[1200px] gap-12 lg:grid-cols-[0.72fr_1.28fr]"><SectionHeading eyebrow="Before you inquire" title="Project and tripping information" description="This frontend version presents general information. Confirm current unit availability, pricing and schedules with an authorized representative." /><FAQAccordion items={faqs} /></div></section></> }
export default FAQs
