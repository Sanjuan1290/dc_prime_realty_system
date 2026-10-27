import { Link } from 'react-router-dom'
import { FiArrowUpRight } from 'react-icons/fi'
import { PageIntro, ProjectTile, SectionTitle, SiteCTA } from '../components/StaticSiteUI'
import { staticProjects } from '../data/staticSite'
import usePageMeta from '../hooks/usePageMeta'

export default function Properties(){
 usePageMeta({title:'Projects | D&C Prime Realty',description:'Explore Prime Enclave in Maragondon and Luntiang Aguinaldo in Bailen, Cavite.'})
 return <><PageIntro eyebrow="OUR LOCATIONS" title="Explore our projects." description="Explore Prime Enclave in Maragondon and Luntiang Aguinaldo in Bailen. See project details, ask for a current quotation, and request a viewing." photo />
 <section className="dc-container dc-section"><SectionTitle eyebrow="CURRENT PROJECTS" title="Find your place." description="Prime Enclave in Maragondon is our featured project. Luntiang Aguinaldo in Bailen is also available for inquiries."/><div className="dc-project-grid">{staticProjects.map((p,i)=><ProjectTile key={p.slug} project={p} featured={i===0}/>)}</div></section>
 <section className="dc-container dc-short-note"><div><h2>Have a question about a lot?</h2><p>Ask for an updated quotation, the documents available for review or current unit information before making a decision.</p></div><Link className="dc-btn dc-btn-dark" to="/contact-us">Ask our team <FiArrowUpRight/></Link></section>
 <SiteCTA /></>
}
