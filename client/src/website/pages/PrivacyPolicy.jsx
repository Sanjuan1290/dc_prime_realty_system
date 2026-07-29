import PageHero from '../components/PageHero'
import usePageMeta from '../hooks/usePageMeta'
import { company } from '../data/company'

const PrivacyPolicy = () => {
  usePageMeta({ title: 'Privacy Notice | D&C Prime Realty', description: 'Read how D&C Prime Realty handles information provided through its public website.' })
  return <><PageHero eyebrow="Legal" title="Privacy notice" description="Information about the personal details you may provide when contacting D&C Prime Realty." /><article className="website-prose mx-auto max-w-[780px] px-5 py-12 lg:py-16"><p className="!mt-0">This frontend website does not currently submit inquiry or tripping-form data to a D&C Prime Realty server. When you choose the email action, your device opens your email application and you decide whether to send the prepared message.</p><h2>Information you may provide</h2><p>You may enter your name, mobile number, email address, preferred project, visit schedule and inquiry message. These details remain in the current browser form unless you choose to send them using an external email or Facebook service.</p><h2>Browser storage</h2><p>The website may store saved and recently viewed project identifiers in your browser. This supports local features without creating an account. You can clear this information through your browser storage settings or the saved-project controls.</p><h2>External services</h2><p>The website links to Google Maps, Facebook and your email application. Their own privacy terms apply when you use those services.</p><h2>Contact</h2><p>Questions about this notice may be sent to {company.email}.</p></article></>
}

export default PrivacyPolicy
