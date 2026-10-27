import { Link, useParams } from 'react-router-dom'
import { FiArrowLeft, FiArrowUpRight, FiCheck, FiMapPin } from 'react-icons/fi'
import { PageIntro, SiteCTA, SitePhoto } from '../components/StaticSiteUI'
import { staticProjects } from '../data/staticSite'
import usePageMeta from '../hooks/usePageMeta'

export default function PropertyDetails(){
 const {projectSlug}=useParams()
 const project=staticProjects.find(p=>p.slug===projectSlug)
 usePageMeta({title:`${project?.name||'Project'} | D&C Prime Realty`,description:project?.intro||'Project information'})
 if(!project)return <><PageIntro eyebrow="PROJECTS" title="Project not found." description="This project isn't part of our current public project list."/><div className="dc-container dc-section"><Link className="dc-btn dc-btn-dark" to="/properties"><FiArrowLeft/> Back to projects</Link></div></>
 return <>
 <section className="dc-detail-hero"><SitePhoto src={project.image} fallback={project.fallback} alt={`${project.name} in ${project.city}`} /><div className="dc-detail-shade"/><div className="dc-container dc-detail-hero-inner"><Link className="dc-back-link" to="/properties"><FiArrowLeft/> All projects</Link><p className="dc-eyebrow">{project.eyebrow}</p><h1>{project.name}</h1><p>{project.subtitle}</p><div className="dc-actions"><Link to={`/book-tripping?project=${project.slug}`} className="dc-btn dc-btn-gold">Book a Tripping <FiArrowUpRight/></Link><Link to="/contact-us" className="dc-btn dc-btn-outline">Request project details</Link></div></div></section>
 <section className="dc-container dc-section dc-detail-main"><div className="dc-detail-copy"><p className="dc-eyebrow">WELCOME TO {project.city.toUpperCase()}</p><h2>Get to know the location.</h2><p>{project.intro}</p><p>Contact the team for updated pricing, available lot sizes, documents and payment terms. Photos are for presentation only until verified project imagery is provided.</p><div className="dc-detail-tag-list">{project.features.map(f=><span key={f}><FiCheck/>{f}</span>)}</div></div><aside className="dc-detail-aside"><p className="dc-eyebrow">PROJECT AT A GLANCE</p><h3>{project.name}</h3><p><FiMapPin/>{project.address}</p><div className="dc-detail-aside-rule"/><span>Pricing and availability</span><strong>Request the latest information</strong><div className="dc-detail-aside-rule"/><Link className="dc-btn dc-btn-dark" to={`/book-tripping?project=${project.slug}`}>Arrange a site visit <FiArrowUpRight/></Link><Link className="dc-text-link" to="/contact-us">Ask a question <FiArrowUpRight/></Link></aside></section>
 <section className="dc-feature-section"><div className="dc-container"><div className="dc-section-heading"><div><p className="dc-eyebrow">THE EXPERIENCE</p><h2>Three things to explore.</h2></div></div><div className="dc-points-grid">{project.points.map(item=><article key={item.number}><span>{item.number}</span><h3>{item.title}</h3><p>{item.detail}</p></article>)}</div></div></section>
 <section className="dc-container dc-section"><div className="dc-section-heading"><div><p className="dc-eyebrow">A LOOK AT THE LOCATION</p><h2>Picture the possibilities.</h2><p>Sample imagery represents the site's intended visual presentation, not verified lot conditions.</p></div></div><div className="dc-detail-gallery"><SitePhoto alwaysSample fallback={project.fallback} alt="Illustrative countryside scenery"/><SitePhoto alwaysSample fallback="/website/images/redesign/scenic-guide-placeholder.jpg" alt="Illustrative land access view"/></div></section>
 <SiteCTA title={`Visit ${project.name} in person.`} description="Request a date, and our team can confirm the meeting point and availability." />
 </>
}
