import { Link } from 'react-router-dom'
import { FiArrowUpRight, FiFacebook, FiMail, FiMapPin } from 'react-icons/fi'
import BrandLogo from './BrandLogo'
import { brand, navigation, staticProjects } from '../data/staticSite'

export default function WebsiteFooter() {
 return <footer className="dc-footer">
   <div className="dc-container dc-footer-grid">
    <div className="dc-footer-about"><BrandLogo/><p>Thoughtful land opportunities in Cavite, supported by clear information and guided site visits.</p><a href={brand.facebook} target="_blank" rel="noreferrer" className="dc-footer-social"><FiFacebook/> Facebook <FiArrowUpRight /></a></div>
    <div><h3>Explore</h3>{navigation.map(n=><Link key={n.to} to={n.to}>{n.title}</Link>)}</div>
    <div><h3>Our projects</h3>{staticProjects.map(p=><Link key={p.slug} to={`/properties/${p.slug}`}>{p.name} — {p.city}</Link>)}<Link to="/book-tripping">Book a Tripping</Link></div>
    <div><h3>Get in touch</h3><p><FiMapPin/> {brand.address}</p><a href={`mailto:${brand.email}`}><FiMail/> {brand.email}</a><Link className="dc-footer-contact" to="/contact-us">Send an inquiry <FiArrowUpRight/></Link></div>
   </div>
   <div className="dc-container dc-footer-bottom"><span>© {new Date().getFullYear()} D&amp;C Prime Realty.</span><span>Site photography labeled as illustrative is for layout preview only.</span><div><Link to="/privacy-policy">Privacy</Link><Link to="/terms-of-use">Terms</Link><Link to="/disclaimer">Disclaimer</Link></div></div>
 </footer>
}
