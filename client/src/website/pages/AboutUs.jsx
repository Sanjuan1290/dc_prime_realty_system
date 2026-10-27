import { Link } from 'react-router-dom'
import { FiArrowUpRight, FiCheckCircle, FiCompass, FiUsers, FiShield } from 'react-icons/fi'
import { PageIntro, SiteCTA, SitePhoto } from '../components/StaticSiteUI'
import { companyMedia } from '../data/staticSite'
import usePageMeta from '../hooks/usePageMeta'

const values=[{icon:FiShield,title:'Integrity',detail:'Straightforward communication about projects and your options.'},{icon:FiCompass,title:'Guidance',detail:'Practical help at every stage of your inquiry.'},{icon:FiUsers,title:'People',detail:'A service-focused approach to clients and partners.'},{icon:FiCheckCircle,title:'Commitment',detail:'Thoughtful follow-through and attention to detail.'}]
export default function AboutUs(){
 usePageMeta({title:'About D&C Prime Realty',description:'Meet D&C Prime Realty and learn about our Cavite real estate projects.'})
 return <><PageIntro eyebrow="WHO WE ARE" title="Grounded in trust. Focused on people." description="A Cavite real estate team helping clients make more informed property decisions." photo photoSrc={companyMedia.event} />
 <section className="dc-container dc-section dc-about-story"><div><p className="dc-eyebrow">OUR STORY</p><h2>More than a location.<br/>A place to begin.</h2><p>At D&C Prime Realty, we believe a property decision should begin with clarity. We introduce clients to land opportunities in Cavite and help them review location details, current options and the next steps.</p><p>We focus on clear conversations, available project information and opportunities to visit a property before reserving.</p><Link to="/contact-us" className="dc-text-link">Talk to our team <FiArrowUpRight/></Link></div><SitePhoto src={companyMedia.team} alt="D&C Prime Realty office and team photo collage"/></section>
 <section className="dc-feature-section"><div className="dc-container dc-about-values"><p className="dc-eyebrow">WHAT GUIDES US</p><h2>Our values in practice.</h2><div className="dc-values-grid">{values.map(({icon:Icon,title,detail})=><article key={title}><Icon/><h3>{title}</h3><p>{detail}</p></article>)}</div></div></section>
 <section className="dc-container dc-section dc-about-statement"><span className="dc-eyebrow">LOOKING AHEAD</span><h2>Building connections between people, places and the plans that matter to them.</h2><div className="dc-actions"><Link to="/properties" className="dc-btn dc-btn-dark">View projects <FiArrowUpRight/></Link><Link to="/opportunities" className="dc-btn dc-btn-line">Join our team <FiArrowUpRight/></Link></div></section><SiteCTA /></>
}
