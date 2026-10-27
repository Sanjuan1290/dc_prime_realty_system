import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowRight, FiArrowUpRight, FiMapPin } from 'react-icons/fi'
import { brand } from '../data/staticSite'

export function PageIntro({eyebrow,title,description,photo=false}){
 return <section className={`dc-page-intro ${photo?'dc-intro-image':''}`} style={photo?{'--dc-intro-image':`url(${brand.hero})`}:undefined}>
  <div className="dc-container"><p className="dc-eyebrow">{eyebrow}</p><h1>{title}</h1>{description&&<p className="dc-page-lead">{description}</p>}</div>
 </section>
}
export function SectionTitle({eyebrow,title,description,action,to}){
 return <div className="dc-section-heading"><div><p className="dc-eyebrow">{eyebrow}</p><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action&&<Link to={to} className="dc-text-link">{action}<FiArrowUpRight/></Link>}</div>
}
export function SitePhoto({src,fallback,alt,className='',alwaysSample=false}){
 const [sample,setSample]=useState(alwaysSample || !src)
 useEffect(()=>setSample(alwaysSample || !src),[src,alwaysSample])
 const image=sample?fallback:src
 return <div className={`dc-photo ${className}`}>
  <img src={image} alt={alt} loading="lazy" onError={()=>setSample(true)}/>
  {sample&&<span className="dc-sample-label">Illustrative image</span>}
 </div>
}
export function ProjectTile({project,featured=false}){
 return <article className={`dc-project-tile ${featured?'dc-project-featured':''}`}>
  <Link to={`/properties/${project.slug}`} aria-label={`View ${project.name} project details`} className="dc-project-image-link">
   <SitePhoto src={project.image} fallback={project.fallback} alt={`${project.name} property scenery`} />
  </Link>
  <div className="dc-project-content"><span className="dc-tag">{project.status}</span><div className="dc-project-title-row"><div><h3>{project.name}</h3><p><FiMapPin/>{project.city}</p></div><Link to={`/properties/${project.slug}`} className="dc-icon-link" aria-label={`View ${project.name}`}><FiArrowUpRight/></Link></div><p className="dc-project-intro">{project.intro}</p><Link to={`/properties/${project.slug}`} className="dc-text-link">View project details <FiArrowRight/></Link></div>
 </article>
}
export function SiteCTA({title='See the site for yourself.',description='Request a guided visit and ask the team about current lot availability.'}){
 return <section id="book-tripping" className="dc-cta"><div className="dc-container dc-cta-inner"><div><p className="dc-eyebrow">PLAN YOUR VISIT</p><h2>{title}</h2><p>{description}</p></div><Link to="/book-tripping" className="dc-btn dc-btn-gold">Book a Tripping <FiArrowUpRight/></Link></div></section>
}
