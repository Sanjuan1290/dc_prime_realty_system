import { Link, useParams } from 'react-router-dom'
import { FiArrowLeft, FiArrowUpRight, FiCheck, FiMapPin, FiFileText, FiCalendar, FiHelpCircle } from 'react-icons/fi'
import { PageIntro, SiteCTA, SitePhoto } from '../components/StaticSiteUI'
import { staticProjects } from '../data/staticSite'
import usePageMeta from '../hooks/usePageMeta'

export default function PropertyDetails(){
 const {projectSlug}=useParams()
 const project=staticProjects.find(p=>p.slug===projectSlug)
 usePageMeta({title:`${project?.name||'Project'} | D&C Prime Realty`,description:project?.intro||'Project information'})
 if(!project)return <><PageIntro eyebrow="PROJECTS" title="Project not found." description="This project isn't part of our current public project list."/><div className="dc-container dc-section"><Link className="dc-btn dc-btn-dark" to="/properties"><FiArrowLeft/> Back to projects</Link></div></>
 return <>
 <section className="dc-detail-hero"><SitePhoto src={project.image} fallback={project.fallback} alt={`${project.name} in ${project.city}`} priority /><div className="dc-detail-shade"/><div className="dc-container dc-detail-hero-inner"><nav aria-label="Breadcrumb" className="dc-breadcrumb"><Link to="/">Home</Link><span aria-hidden="true">/</span><Link to="/properties">Projects</Link><span aria-hidden="true">/</span><span aria-current="page">{project.name}</span></nav><p className="dc-eyebrow">{project.eyebrow}</p><h1>{project.name}</h1><p>{project.subtitle}</p><div className="dc-actions"><Link to={`/book-tripping?project=${project.slug}`} className="dc-btn dc-btn-gold">Book a Tripping <FiArrowUpRight/></Link><Link to="/contact-us" className="dc-btn dc-btn-outline">Request project details</Link></div></div></section>
 <section className="dc-container dc-section dc-detail-main"><div className="dc-detail-copy"><p className="dc-eyebrow">WELCOME TO {project.city.toUpperCase()}</p><h2>Get to know the location.</h2><p>{project.intro}</p><p>Contact the team for updated pricing, available lot sizes, documents and payment terms. The gallery shows images supplied through the D&C Prime Realty project media folder. Ask the team to confirm the exact lot, boundaries and current conditions.</p><div className="dc-detail-tag-list">{project.features.map(f=><span key={f}><FiCheck/>{f}</span>)}</div></div><aside className="dc-detail-aside"><p className="dc-eyebrow">PROJECT AT A GLANCE</p><h3>{project.name}</h3><p><FiMapPin/>{project.address}</p><div className="dc-detail-aside-rule"/><span>Pricing, available lot sizes and terms</span><strong>Request a dated written quotation</strong><p className="dc-small-disclosure">Figures can change. Confirm current availability, payment options and official documentation with our team.</p><div className="dc-detail-aside-rule"/><Link className="dc-btn dc-btn-dark" to={`/book-tripping?project=${project.slug}`}>Arrange a site visit <FiArrowUpRight/></Link><Link className="dc-text-link" to="/contact-us">Ask a question <FiArrowUpRight/></Link></aside></section>
 <section className="dc-feature-section"><div className="dc-container"><div className="dc-section-heading"><div><p className="dc-eyebrow">THE EXPERIENCE</p><h2>Three things to explore.</h2></div></div><div className="dc-points-grid">{project.points.map(item=><article key={item.number}><span>{item.number}</span><h3>{item.title}</h3><p>{item.detail}</p></article>)}</div></div></section>
 <section className="dc-container dc-section"><div className="dc-section-heading"><div><p className="dc-eyebrow">PROJECT PHOTOS</p><h2>See the location.</h2><p>Photos are from the relevant D&C Prime Realty media folder. Ask the team which views relate to the lot you're considering.</p></div></div>
  <div className="dc-media-gallery">{project.gallery.map(item=><figure className="dc-media-figure" key={item.src}><SitePhoto src={item.src} fallback={project.fallback} alt={item.alt}/><figcaption>{item.caption}</figcaption></figure>)}</div>
  {project.slug === 'luntiang-aguinaldo-bailen' && <p className="dc-gallery-notice">River and waterfall photos are from the Bailen area collection. They are not advertised as amenities within the project.</p>}
 </section>
 <section className="dc-project-video-section"><div className="dc-container dc-video-grid"><div><p className="dc-eyebrow">WATCH THE PROJECT VIDEO</p><h2>{project.name}, from the ground and above.</h2><p>{project.video.note}</p><Link className="dc-text-link" to={`/book-tripping?project=${project.slug}`}>Request a site visit <FiArrowUpRight/></Link></div><div className="dc-video-frame"><video controls playsInline preload="none" poster={project.image} aria-label={project.video.label}><source src={project.video.src} type="video/mp4"/>Your browser cannot play this video.</video><span>Video provided by D&C Prime Realty</span></div></div></section>
 <section className="dc-container dc-section dc-buying-answers" aria-labelledby="buyer-answers-title">
  <div className="dc-section-heading"><div><p className="dc-eyebrow">BUYER INFORMATION</p><h2 id="buyer-answers-title">What to check before reserving.</h2><p>We can help you request written details for the exact lot you're considering.</p></div><Link to="/contact-us" className="dc-text-link">Ask about documentation <FiArrowUpRight/></Link></div>
  <div className="dc-information-grid">
    <article><FiMapPin aria-hidden="true"/><h3>Location & access</h3><p>Review the road, terrain, neighborhood and actual lot boundaries during your visit.</p></article>
    <article><FiFileText aria-hidden="true"/><h3>Lot documents</h3><p>Ask for the title details, available certified copies, restrictions and applicable contract documents.</p></article>
    <article><FiCalendar aria-hidden="true"/><h3>Price & payment terms</h3><p>Request current lot size, total price, reservation terms, installment sample and applicable fees in writing.</p></article>
  </div>
  <div className="dc-project-faq"><div><p className="dc-eyebrow">FREQUENT QUESTIONS</p><h3>Questions worth asking.</h3><p>Answers depend on the selected lot and current approved terms.</p></div><div className="dc-faq-list">
    <details><summary>Can I see the property before reserving?</summary><p>Yes, request a preferred viewing date. The team will reply to confirm the schedule and meeting point.</p></details>
    <details><summary>How do I check the title and property documents?</summary><p>Ask the team for the available title details and supporting documents. You can also arrange independent verification with the proper government office or a qualified professional.</p></details>
    <details><summary>Are the lot sizes and prices on this site final?</summary><p>No. This static preview does not display live availability or a guaranteed offer. Request an updated, dated quotation for your chosen lot.</p></details>
    <details><summary>What happens after I submit a tripping request?</summary><p>Your email application prepares a message for you to send. The visit is not booked until the office responds and confirms the appointment.</p></details>
  </div></div>
 </section>
 <SiteCTA projectSlug={project.slug} title={`Visit ${project.name} in person.`} description="Request a date, and our team can confirm the meeting point and availability." />
 </>
}
