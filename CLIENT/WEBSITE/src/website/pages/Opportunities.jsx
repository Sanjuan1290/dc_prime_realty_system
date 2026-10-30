import { Link } from 'react-router-dom'
import { FiArrowUpRight, FiCompass, FiUsers, FiMessageCircle } from 'react-icons/fi'
import { PageIntro, SiteCTA, SitePhoto } from '../components/StaticSiteUI'
import { companyMedia } from '../data/staticSite'
import usePageMeta from '../hooks/usePageMeta'
export default function Opportunities(){
 usePageMeta({title:'Opportunities | D&C Prime Realty',description:'Get in touch with D&C Prime Realty about career and partnership interests.'})
 return <><PageIntro eyebrow="CAREERS & OPPORTUNITIES" title="Do meaningful work with us." description="Interested in a future role or a chance to work with our team? Introduce yourself." photo photoSrc={companyMedia.event}/>
 <section className="dc-container dc-section dc-about-story"><div><p className="dc-eyebrow">CAREERS</p><h2>Let's build something good.</h2><p>Real estate combines people, communication and practical work. We welcome expressions of interest from people with backgrounds in sales, administration, marketing, property assistance and other support functions.</p><p><strong>There are no specific vacancies advertised on this static website.</strong> Contact our team to ask about current opportunities and how applications are handled.</p><Link to="/contact-us?subject=Career%20Inquiry" className="dc-btn dc-btn-dark">Send your interest <FiArrowUpRight/></Link></div><SitePhoto src={companyMedia.event} alt="D&C Prime Realty team at a professional event"/></section>
 <section className="dc-feature-section"><div className="dc-container"><div className="dc-section-heading"><div><p className="dc-eyebrow">YOUR NEXT STEP</p><h2>Ways to connect.</h2></div></div><div className="dc-values-grid dc-values-three"><article><FiUsers/><h3>Careers</h3><p>Ask about office, field and operational opportunities.</p></article><article><FiCompass/><h3>Sales network</h3><p>Learn more about accredited seller participation.</p></article><article><FiMessageCircle/><h3>General inquiries</h3><p>Introduce your skills and explain what kind of work interests you.</p></article></div></div></section><SiteCTA title="Interested in partnering with us?" description="Contact the office for information about seller accreditation and available opportunities."/></>
}

