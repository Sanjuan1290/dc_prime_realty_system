import { Link } from 'react-router-dom'

const BrandLogo = ({ light = false, compact = false }) => (
  <Link to="/" className="inline-flex items-center" aria-label="D&C Prime Realty home">
    <img
      src="/website/images/brand/dc-prime-logo.svg"
      alt="D&C Prime Realty"
      className={`${compact ? 'h-[48px] w-[198px]' : 'h-[58px] w-[240px]'} object-contain object-left ${light ? 'brightness-0 invert' : ''}`}
    />
  </Link>
)

export default BrandLogo


