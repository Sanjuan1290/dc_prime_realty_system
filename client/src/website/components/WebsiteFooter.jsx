import { FiArrowRight, FiMapPin, FiShield } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import { company, siteNavigation } from '../data/company'

const WebsiteFooter = () => (
  <footer className="bg-[#141109] text-white">
    <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-14 md:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_1fr] lg:px-8">
      <div className="max-w-xl">
        <BrandLogo light />
        <p className="mt-6 max-w-lg text-[14px] leading-7 text-[#d9d1bf]">D&amp;C Prime Realty presents property options and guided site visits for its current projects in Bailen and Maragondon, Cavite.</p>
        <div className="mt-5 flex items-start gap-3 text-[13px] leading-6 text-[#d9d1bf]">
          <FiMapPin className="mt-1 h-4 w-4 shrink-0 text-[#e5b93f]" />
          <span>{company.address}</span>
        </div>
      </div>

      <div>
        <h2 className="text-[13px] font-black uppercase tracking-[0.2em] text-[#e5b93f]">Website</h2>
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
          {siteNavigation.map((item) => <Link key={item.to} to={item.to} className="text-[13px] font-semibold text-[#d9d1bf] hover:text-white">{item.label}</Link>)}
        </div>
      </div>

      <div>
        <h2 className="text-[13px] font-black uppercase tracking-[0.2em] text-[#e5b93f]">Current projects</h2>
        <div className="mt-5 space-y-3">
          <Link to="/properties/luntiang-aguinaldo-bailen" className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[13px] font-bold text-white hover:border-[#e5b93f]/50">
            Luntiang Aguinaldo <FiArrowRight className="transition group-hover:translate-x-1" />
          </Link>
          <Link to="/properties/prime-enclave-maragondon" className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[13px] font-bold text-white hover:border-[#e5b93f]/50">
            Prime Enclave <FiArrowRight className="transition group-hover:translate-x-1" />
          </Link>
        </div>
        <Link to="/portal" className="mt-6 inline-flex items-center gap-2 text-[12px] font-semibold text-[#a99f8b] hover:text-white"><FiShield /> Authorized user portal</Link>
      </div>
    </div>
    <div className="border-t border-white/10 px-5 py-5 text-center text-[12px] text-[#a99f8b]">© 2026 D&amp;C Prime Realty. Frontend website preview.</div>
  </footer>
)

export default WebsiteFooter
