import { Link } from 'react-router-dom'
import { brand } from '../data/staticSite'

export default function BrandLogo() {
  return <Link to="/" className="dc-brand" aria-label="D&C Prime Realty, go to homepage">
    <img src={brand.logo} alt="D&C Prime Realty" />
  </Link>
}
