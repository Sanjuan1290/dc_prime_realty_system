import { FiFacebook, FiMail, FiMapPin } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import { company, flattenNavigation } from '../data/company'
import { projects } from '../data/projects'

const WebsiteFooter = () => (
  <footer className="bg-[#15120c] pb-[64px] text-white lg:pb-0">
    <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-[1.35fr_0.8fr_0.95fr_1fr] lg:px-8">
      <div className="max-w-[430px]">
        <BrandLogo light />
        <p className="mt-5 text-[13px] leading-6 text-[#d4cec2]">Property information and guided site visits for current projects in Bailen and Maragondon, with a General Trias project coming soon.</p>
        <div className="mt-4 flex items-start gap-3 text-[12px] leading-6 text-[#c6beb0]"><FiMapPin className="mt-1 h-4 w-4 shrink-0 text-[#d4aa3b]" /><span>{company.address}</span></div>
      </div>

      <div>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d4aa3b]">Properties</h2>
        <div className="mt-4 grid gap-3">
          {projects.map((project) => <Link key={project.slug} to={`/properties/${project.slug}`} className="text-[12px] text-[#d4cec2] transition hover:text-white">{project.name}{project.status === 'coming_soon' ? ' — Coming Soon' : ''}</Link>)}
          <Link to="/properties" className="text-[12px] text-[#d4cec2] hover:text-white">Compare Projects</Link>
        </div>
      </div>

      <div>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d4aa3b]">Company & Resources</h2>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-1">
          {flattenNavigation.filter((item) => !['Home', 'Properties', 'Contact Us', 'Luntiang Aguinaldo', 'Prime Enclave', 'General Trias'].includes(item.label)).map((item) => <Link key={item.to} to={item.to} className="text-[12px] text-[#d4cec2] transition hover:text-white">{item.label}</Link>)}
        </div>
      </div>

      <div>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d4aa3b]">Contact</h2>
        <div className="mt-4 grid gap-3">
          <a href={`mailto:${company.email}`} className="inline-flex items-center gap-2 text-[12px] text-[#d4cec2] hover:text-white"><FiMail /> {company.email}</a>
          <a href={company.facebookUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[12px] text-[#d4cec2] hover:text-white"><FiFacebook /> Facebook</a>
          <Link to="/contact-us" className="text-[12px] text-[#d4cec2] hover:text-white">Contact Us</Link>
        </div>
        <div className="mt-5 grid gap-2 border-t border-white/10 pt-4">
          <Link to="/privacy-policy" className="text-[11px] text-[#9e9689] hover:text-white">Privacy Notice</Link>
          <Link to="/terms-of-use" className="text-[11px] text-[#9e9689] hover:text-white">Terms of Use</Link>
          <Link to="/disclaimer" className="text-[11px] text-[#9e9689] hover:text-white">Property Disclaimer</Link>
        </div>
      </div>
    </div>
    <div className="border-t border-white/10 px-5 py-4 text-center text-[11px] text-[#8f887b]">© 2026 D&amp;C Prime Realty. All rights reserved.</div>
  </footer>
)

export default WebsiteFooter

