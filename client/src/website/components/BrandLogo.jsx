import { FiHome } from 'react-icons/fi'
import { Link } from 'react-router-dom'

const BrandLogo = ({ light = false, compact = false }) => (
  <Link to="/" className="group inline-flex items-center gap-3" aria-label="D&C Prime Realty home">
    <span className={`flex shrink-0 items-center justify-center rounded-2xl border ${compact ? 'h-10 w-10' : 'h-12 w-12'} ${light ? 'border-[#e7bd48]/50 bg-[#e7bd48]/10' : 'border-[#d4a62f]/30 bg-[#fff8df]'}`}>
      <FiHome className={`${compact ? 'h-5 w-5' : 'h-6 w-6'} text-[#c79216]`} aria-hidden="true" />
    </span>
    <span className="leading-none">
      <span className={`block font-black tracking-[-0.04em] ${compact ? 'text-[17px]' : 'text-[20px]'} ${light ? 'text-white' : 'text-[#17130a]'}`}>D&amp;C Prime Realty</span>
      <span className={`mt-1 block text-[10px] font-semibold uppercase tracking-[0.18em] ${light ? 'text-[#e8cf8c]' : 'text-[#8a6a1d]'}`}>Trusted real estate solutions</span>
    </span>
  </Link>
)

export default BrandLogo
