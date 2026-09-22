import PageHero from '../components/PageHero'
import usePageMeta from '../hooks/usePageMeta'

const TermsOfUse = () => {
  usePageMeta({ title: 'Website Terms of Use | D&C Prime Realty', description: 'Read the terms that apply to D&C Prime Realty public website content and buyer tools.' })
  return <><PageHero eyebrow="Legal" title="Website terms of use" description="Conditions that apply when using the public project information and frontend buyer tools." /><article className="website-prose mx-auto max-w-[780px] px-5 py-12 lg:py-16"><p className="!mt-0">The website provides general project information, images and buyer resources. Content may be revised as project conditions, pricing and availability change.</p><h2>No reservation or confirmed appointment</h2><p>Using a form, calculator or saved-project feature does not create a reservation, sale, confirmed viewing schedule or contractual obligation.</p><h2>Official information</h2><p>Request the latest written quotation, available-unit list, document checklist and payment breakdown from an authorized D&C Prime Realty representative before making a payment or decision.</p><h2>Acceptable use</h2><p>Do not attempt to disrupt the website, misuse its content or represent yourself as D&C Prime Realty without written authority.</p></article></>
}

export default TermsOfUse
